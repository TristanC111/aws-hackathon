import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);

// shared/dynamo.mjs
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
var region = process.env.AWS_REGION || "us-east-1";
var table = process.env.DYNAMO_TABLE || "refugeaid-sessions";
var base = new DynamoDBClient({ region });
var ddb = DynamoDBDocumentClient.from(base, {
  marshallOptions: { removeUndefinedValues: true }
});
var SESSION_TTL_SECONDS = 60 * 60 * 24;
async function getSession(sessionId) {
  const res = await ddb.send(
    new GetCommand({ TableName: table, Key: { sessionId } })
  );
  return res.Item || null;
}
async function updateSession(sessionId, fields) {
  const entries = Object.entries(fields);
  if (entries.length === 0) return;
  const names = {};
  const values = {};
  const sets = [];
  for (const [k, v] of entries) {
    names[`#${k}`] = k;
    values[`:${k}`] = v;
    sets.push(`#${k} = :${k}`);
  }
  await ddb.send(
    new UpdateCommand({
      TableName: table,
      Key: { sessionId },
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values
    })
  );
}

// shared/textract.mjs
import {
  TextractClient,
  DetectDocumentTextCommand,
  StartDocumentTextDetectionCommand,
  GetDocumentTextDetectionCommand
} from "@aws-sdk/client-textract";
var region2 = process.env.AWS_REGION || "us-east-1";
var bucket = process.env.S3_BUCKET || "refugeaid-docs";
var textract = new TextractClient({ region: region2 });
async function detectTextAsync(s3Key, { pollMs = 1500, maxWaitMs = 6e4 } = {}) {
  const start = await textract.send(
    new StartDocumentTextDetectionCommand({
      DocumentLocation: { S3Object: { Bucket: bucket, Name: s3Key } }
    })
  );
  const jobId = start.JobId;
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await sleep(pollMs);
    const status = await textract.send(
      new GetDocumentTextDetectionCommand({ JobId: jobId })
    );
    if (status.JobStatus === "SUCCEEDED") {
      const allBlocks = [...status.Blocks || []];
      let next = status.NextToken;
      while (next) {
        const page = await textract.send(
          new GetDocumentTextDetectionCommand({ JobId: jobId, NextToken: next })
        );
        allBlocks.push(...page.Blocks || []);
        next = page.NextToken;
      }
      return blocksToText(allBlocks);
    }
    if (status.JobStatus === "FAILED") {
      throw new Error(`Textract job failed: ${status.StatusMessage || "unknown"}`);
    }
  }
  throw new Error("Textract job timed out");
}
function blocksToText(blocks) {
  const lines = blocks.filter((b) => b.BlockType === "LINE");
  const pageCount = Math.max(1, ...blocks.map((b) => b.Page || 1));
  const pages = Array.from({ length: pageCount }, () => []);
  for (const line of lines) {
    const p = (line.Page || 1) - 1;
    pages[p].push(line.Text || "");
  }
  return {
    fullText: pages.map((p) => p.join("\n")).join("\n\n"),
    pages: pages.map((p) => p.join("\n")),
    pageCount
  };
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// shared/translate.mjs
import {
  TranslateClient,
  TranslateTextCommand
} from "@aws-sdk/client-translate";
var region3 = process.env.AWS_REGION || "us-east-1";
var translate = new TranslateClient({ region: region3 });
var MAX_CHUNK_BYTES = 9e3;
async function translateText(text, { from = "auto", to }) {
  if (!text || !text.trim()) return { text: "", detectedLanguage: from };
  if (from === to) return { text, detectedLanguage: from };
  const chunks = chunkByBytes(text, MAX_CHUNK_BYTES);
  const out = [];
  let detected = from;
  for (const chunk of chunks) {
    const res = await translate.send(
      new TranslateTextCommand({
        Text: chunk,
        SourceLanguageCode: from,
        TargetLanguageCode: to
      })
    );
    out.push(res.TranslatedText || "");
    if (res.SourceLanguageCode) detected = res.SourceLanguageCode;
  }
  return { text: out.join(""), detectedLanguage: detected };
}
function chunkByBytes(text, limit) {
  const enc = new TextEncoder();
  const bytes = enc.encode(text);
  if (bytes.length <= limit) return [text];
  const chunks = [];
  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    if (end < bytes.length) {
      const slice = bytes.slice(start, end);
      const text2 = new TextDecoder().decode(slice);
      const lastBreak = Math.max(text2.lastIndexOf("\n"), text2.lastIndexOf(". "));
      if (lastBreak > limit / 2) {
        const trimmed = text2.slice(0, lastBreak + 1);
        chunks.push(trimmed);
        start += enc.encode(trimmed).length;
        continue;
      }
    }
    chunks.push(new TextDecoder().decode(bytes.slice(start, end)));
    start = end;
  }
  return chunks;
}

// shared/bedrock.mjs
import {
  BedrockRuntimeClient,
  InvokeModelCommand
} from "@aws-sdk/client-bedrock-runtime";
var region4 = process.env.AWS_REGION || "us-east-1";
var defaultModel = process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-5-sonnet-20241022-v2:0";
var bedrock = new BedrockRuntimeClient({ region: region4 });
async function invokeClaude({
  system,
  user,
  maxTokens = 2e3,
  temperature = 0.2,
  modelId = defaultModel
}) {
  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: "user", content: [{ type: "text", text: user }] }]
  };
  const res = await bedrock.send(
    new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload)
    })
  );
  const raw = new TextDecoder().decode(res.body);
  const parsed = JSON.parse(raw);
  const text = (parsed.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return { text, usage: parsed.usage };
}
function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
    }
  }
  const firstBrace = text.indexOf("{");
  const firstBracket = text.indexOf("[");
  const starts = [firstBrace, firstBracket].filter((i) => i >= 0);
  if (starts.length === 0) return null;
  const start = Math.min(...starts);
  const opener = text[start];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === opener) depth++;
    else if (c === closer) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// shared/prompts.mjs
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
var here = dirname(fileURLToPath(import.meta.url));
var CANDIDATES = [join(here, "prompts"), join(here, "..", "prompts")];
var cache = /* @__PURE__ */ new Map();
async function loadPrompt(name) {
  if (cache.has(name)) return cache.get(name);
  const dir = CANDIDATES.find((p) => existsSync(p));
  if (!dir) throw new Error(`Could not find prompts directory in ${CANDIDATES.join(" or ")}`);
  const text = await readFile(join(dir, `${name}.txt`), "utf-8");
  cache.set(name, text);
  return text;
}

// shared/sections.mjs
var HEADER_RE = /^(?:Part\s+[A-Z0-9.IVX]+|Section\s+\d+|[A-Z][A-Z ]{4,}|\d+\.\s+[A-Z])/;
var MAX_SECTION_CHARS = 1800;
var MIN_SECTION_CHARS = 80;
function splitIntoSections(fullText) {
  if (!fullText || !fullText.trim()) return [];
  const lines = fullText.split(/\r?\n/);
  const sections = [];
  let current = [];
  const flush = () => {
    const text = current.join("\n").trim();
    if (text.length >= MIN_SECTION_CHARS) sections.push(text);
    else if (text.length > 0 && sections.length > 0) {
      sections[sections.length - 1] += "\n" + text;
    }
    current = [];
  };
  for (const line of lines) {
    if (HEADER_RE.test(line.trim()) && current.length > 0) {
      flush();
    }
    current.push(line);
    if (current.join("\n").length > MAX_SECTION_CHARS) flush();
  }
  flush();
  if (sections.length <= 1 && fullText.length > MAX_SECTION_CHARS) {
    return chunkByParagraphs(fullText);
  }
  return sections.map((text, index) => ({
    sectionId: `sec_${String(index + 1).padStart(3, "0")}`,
    index,
    text
  }));
}
function chunkByParagraphs(text) {
  const paragraphs = text.split(/\n\s*\n/);
  const out = [];
  let buf = "";
  for (const p of paragraphs) {
    if ((buf + "\n\n" + p).length > MAX_SECTION_CHARS && buf.length > 0) {
      out.push(buf.trim());
      buf = p;
    } else {
      buf = buf ? buf + "\n\n" + p : p;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.map((t, index) => ({
    sectionId: `sec_${String(index + 1).padStart(3, "0")}`,
    index,
    text: t
  }));
}

// shared/response.mjs
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
};
function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS
    },
    body: JSON.stringify(body)
  };
}
function ok(body) {
  return json(200, body);
}
function error(statusCode, code, message) {
  return json(statusCode, { error: code, message });
}
function preflight() {
  return { statusCode: 204, headers: CORS_HEADERS, body: "" };
}
function handleOptions(event) {
  if (event?.requestContext?.http?.method === "OPTIONS" || event?.httpMethod === "OPTIONS") {
    return preflight();
  }
  return null;
}
function parseBody(event) {
  if (!event?.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf-8") : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// lambdas/analyze/index.mjs
var MAX_CONCURRENT_SECTIONS = 4;
var handler = async (event) => {
  const pre = handleOptions(event);
  if (pre) return pre;
  const body = parseBody(event);
  const sessionId = body.sessionId;
  const language = (body.language || "").toLowerCase();
  if (!sessionId) return error(400, "MISSING_SESSION", "sessionId is required.");
  if (!language) return error(400, "MISSING_LANGUAGE", "language is required.");
  const session = await getSession(sessionId);
  if (!session) return error(404, "SESSION_NOT_FOUND", "Session has expired or does not exist.");
  await updateSession(sessionId, { status: "analyzing" });
  let extraction;
  try {
    extraction = await detectTextAsync(session.s3Key);
  } catch (e) {
    console.error("Textract failed", e);
    await updateSession(sessionId, { status: "uploaded" });
    return error(500, "TEXTRACT_FAILED", "Could not extract text from the document.");
  }
  const englishText = await ensureEnglish(extraction.fullText);
  const rawSections = splitIntoSections(englishText.text);
  if (rawSections.length === 0) {
    return error(500, "NO_SECTIONS", "Could not identify any sections in the document.");
  }
  const explainerSystem = await loadPrompt("explainer");
  const sections = await mapWithConcurrency(
    rawSections,
    MAX_CONCURRENT_SECTIONS,
    async (sec) => explainSection(sec, explainerSystem, language)
  );
  const documentTitle = guessTitle(rawSections[0]?.text) || "Immigration Document";
  const highRiskCount = sections.filter((s) => s.riskLevel === "high").length;
  await updateSession(sessionId, {
    status: "in_progress",
    sections: JSON.stringify(sections),
    documentTitle
  });
  return ok({
    sessionId,
    documentTitle,
    language,
    sections,
    totalSections: sections.length,
    highRiskCount
  });
};
async function ensureEnglish(text) {
  try {
    const { text: translated, detectedLanguage } = await translateText(text, {
      from: "auto",
      to: "en"
    });
    return { text: translated, detectedLanguage };
  } catch (e) {
    console.warn("Translate to English failed, falling back to original text", e);
    return { text, detectedLanguage: "en" };
  }
}
async function explainSection(section, system, targetLang) {
  const user = `Document section:
"""
${section.text}
"""`;
  let analysis;
  try {
    const { text } = await invokeClaude({ system, user, maxTokens: 800 });
    analysis = extractJson(text) || {};
  } catch (e) {
    console.error("Bedrock failed for section", section.sectionId, e);
    analysis = {};
  }
  const safe = {
    plain_explanation: analysis.plain_explanation || "",
    why_it_matters: analysis.why_it_matters || "",
    risk_level: ["high", "medium", "low"].includes(analysis.risk_level) ? analysis.risk_level : "low",
    risk_reason: analysis.risk_reason || null,
    safe_to_suggest: typeof analysis.safe_to_suggest === "boolean" ? analysis.safe_to_suggest : false,
    suggested_answer: analysis.suggested_answer || null
  };
  if (safe.risk_level === "high") {
    safe.safe_to_suggest = false;
    safe.suggested_answer = null;
  }
  const localized = await localize(safe, targetLang);
  return {
    sectionId: section.sectionId,
    index: section.index,
    originalText: section.text,
    plainExplanation: localized.plain_explanation,
    whyItMatters: localized.why_it_matters,
    riskLevel: safe.risk_level,
    riskReason: localized.risk_reason,
    safeToSuggest: safe.safe_to_suggest,
    suggestedAnswer: localized.suggested_answer
  };
}
async function localize(analysis, targetLang) {
  if (!targetLang || targetLang === "en") return analysis;
  const fields = ["plain_explanation", "why_it_matters", "risk_reason", "suggested_answer"];
  const out = { ...analysis };
  for (const f of fields) {
    if (!analysis[f]) continue;
    try {
      const { text } = await translateText(analysis[f], { from: "en", to: targetLang });
      out[f] = text;
    } catch (e) {
      console.warn("Translate output failed for field", f, e);
    }
  }
  return out;
}
function guessTitle(firstSectionText) {
  if (!firstSectionText) return null;
  const firstLine = firstSectionText.split(/\r?\n/).find((l) => l.trim().length > 0);
  if (!firstLine) return null;
  return firstLine.trim().slice(0, 120);
}
async function mapWithConcurrency(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return out;
}
export {
  handler
};
