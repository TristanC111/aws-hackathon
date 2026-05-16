import { getSession, updateSession } from "../../shared/dynamo.mjs";
import { detectTextAsync } from "../../shared/textract.mjs";
import { translateText } from "../../shared/translate.mjs";
import { invokeClaude, extractJson } from "../../shared/bedrock.mjs";
import { loadPrompt } from "../../shared/prompts.mjs";
import { splitIntoSections } from "../../shared/sections.mjs";
import { ok, error, handleOptions, parseBody } from "../../shared/response.mjs";

const MAX_CONCURRENT_SECTIONS = 4;

export const handler = async (event) => {
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
    documentTitle,
  });

  return ok({
    sessionId,
    documentTitle,
    language,
    sections,
    totalSections: sections.length,
    highRiskCount,
  });
};

async function ensureEnglish(text) {
  // Textract returns the original language. We translate to English so Bedrock
  // can reason over it consistently regardless of source language.
  try {
    const { text: translated, detectedLanguage } = await translateText(text, {
      from: "auto",
      to: "en",
    });
    return { text: translated, detectedLanguage };
  } catch (e) {
    console.warn("Translate to English failed, falling back to original text", e);
    return { text, detectedLanguage: "en" };
  }
}

async function explainSection(section, system, targetLang) {
  const user = `Document section:\n"""\n${section.text}\n"""`;
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
    risk_level: ["high", "medium", "low"].includes(analysis.risk_level)
      ? analysis.risk_level
      : "low",
    risk_reason: analysis.risk_reason || null,
    safe_to_suggest:
      typeof analysis.safe_to_suggest === "boolean" ? analysis.safe_to_suggest : false,
    suggested_answer: analysis.suggested_answer || null,
  };

  // High risk → never suggest, regardless of what the model said.
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
    suggestedAnswer: localized.suggested_answer,
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
