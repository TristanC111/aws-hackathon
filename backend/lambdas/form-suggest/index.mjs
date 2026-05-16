import { invokeClaude, extractJson } from "../../shared/bedrock.mjs";
import { loadPrompt } from "../../shared/prompts.mjs";
import { translateText } from "../../shared/translate.mjs";
import { getSession } from "../../shared/dynamo.mjs";
import { ok, error, handleOptions, parseBody } from "../../shared/response.mjs";

export const handler = async (event) => {
  const pre = handleOptions(event);
  if (pre) return pre;

  const body = parseBody(event);
  const { sessionId, language, fieldId, fieldLabel, fieldDescription } = body;
  const conversationHistory = Array.isArray(body.conversationHistory)
    ? body.conversationHistory
    : [];

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
    conversationHistory,
  });

  let parsed = {};
  try {
    const { text } = await invokeClaude({ system, user, maxTokens: 500 });
    parsed = extractJson(text) || {};
  } catch (e) {
    console.error("Bedrock failed for form-suggest", e);
  }

  const riskLevel = ["high", "medium", "low"].includes(parsed.risk_level)
    ? parsed.risk_level
    : "low";
  const confidence = ["high", "medium", "low"].includes(parsed.confidence)
    ? parsed.confidence
    : "low";

  let suggestedValue = parsed.suggested_value ?? null;
  let reasoning = parsed.reasoning || "";

  // High-risk fields: never auto-suggest a value, route to legal aid messaging.
  if (riskLevel === "high") {
    suggestedValue = null;
    reasoning =
      reasoning ||
      "This field touches a legally sensitive topic. Please answer it yourself or consult a legal aid advisor.";
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
    riskLevel,
  });
};

function buildUserPrompt({ fieldLabel, fieldDescription, conversationHistory }) {
  const history = conversationHistory
    .map(
      (h, i) =>
        `${i + 1}. ${h.fieldLabel || h.fieldId || "field"}: ${h.userAnswer ?? "(no answer)"}`
    )
    .join("\n");

  return [
    `Current field label: ${fieldLabel}`,
    fieldDescription ? `Field description: ${fieldDescription}` : null,
    "",
    "Previous answers in this form:",
    history || "(none yet)",
    "",
    "Suggest a value for the current field based on what you know so far.",
  ]
    .filter(Boolean)
    .join("\n");
}
