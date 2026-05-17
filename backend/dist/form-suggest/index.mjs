import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);

// shared/bedrock.mjs
import {
  BedrockRuntimeClient,
  InvokeModelCommand
} from "@aws-sdk/client-bedrock-runtime";
var region = process.env.AWS_REGION || "us-east-1";
var defaultModel = process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-5-sonnet-20241022-v2:0";
var bedrock = new BedrockRuntimeClient({ region });
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

// shared/translate.mjs
import {
  TranslateClient,
  TranslateTextCommand
} from "@aws-sdk/client-translate";
var region2 = process.env.AWS_REGION || "us-east-1";
var translate = new TranslateClient({ region: region2 });
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

// shared/dynamo.mjs
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
var region3 = process.env.AWS_REGION || "us-east-1";
var table = process.env.DYNAMO_TABLE || "refugeaid-sessions";
var base = new DynamoDBClient({ region: region3 });
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

// lambdas/form-suggest/index.mjs
var handler = async (event) => {
  const pre = handleOptions(event);
  if (pre) return pre;
  const body = parseBody(event);
  const { sessionId, language, fieldId, fieldLabel, fieldDescription } = body;
  const conversationHistory = Array.isArray(body.conversationHistory) ? body.conversationHistory : [];
  if (!sessionId) return error(400, "MISSING_SESSION", "sessionId is required.");
  if (!fieldId || !fieldLabel) {
    return error(400, "MISSING_FIELD", "fieldId and fieldLabel are required.");
  }
  const session = await getSession(sessionId);
  if (!session) return error(404, "SESSION_NOT_FOUND", "Session has expired or does not exist.");
  const targetLang = (language || session.language || "en").toLowerCase();
  const system = await loadPrompt("form-suggest");
  const user = buildUserPrompt({
    fieldLabel,
    fieldDescription,
    conversationHistory
  });
  let parsed = {};
  try {
    const { text } = await invokeClaude({ system, user, maxTokens: 500 });
    parsed = extractJson(text) || {};
  } catch (e) {
    console.error("Bedrock failed for form-suggest", e);
  }
  const riskLevel = ["high", "medium", "low"].includes(parsed.risk_level) ? parsed.risk_level : "low";
  const confidence = ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low";
  let suggestedValue = parsed.suggested_value ?? null;
  let reasoning = parsed.reasoning || "";
  if (riskLevel === "high") {
    suggestedValue = null;
    reasoning = reasoning || "This field touches a legally sensitive topic. Please answer it yourself or consult a legal aid advisor.";
  }
  if (targetLang !== "en" && reasoning) {
    try {
      const { text } = await translateText(reasoning, { from: "en", to: targetLang });
      reasoning = text;
    } catch (e) {
      console.warn("Translate reasoning failed", e);
    }
  }
  return ok({
    fieldId,
    suggestedValue,
    reasoning,
    confidence,
    needsConfirmation: true,
    riskLevel
  });
};
function buildUserPrompt({ fieldLabel, fieldDescription, conversationHistory }) {
  const history = conversationHistory.map(
    (h, i) => `${i + 1}. ${h.fieldLabel || h.fieldId || "field"}: ${h.userAnswer ?? "(no answer)"}`
  ).join("\n");
  return [
    `Current field label: ${fieldLabel}`,
    fieldDescription ? `Field description: ${fieldDescription}` : null,
    "",
    "Previous answers in this form:",
    history || "(none yet)",
    "",
    "Suggest a value for the current field based on what you know so far."
  ].filter(Boolean).join("\n");
}
export {
  handler
};
