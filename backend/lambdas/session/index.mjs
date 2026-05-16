import { getSession, updateSession } from "../../shared/dynamo.mjs";
import { ok, error, handleOptions, parseBody } from "../../shared/response.mjs";

// One Lambda handles three routes:
//   GET  /session/{sessionId}
//   POST /session/save
//   POST /session (alternate save route)
//
// API Gateway should forward the path so we can branch on it here.
export const handler = async (event) => {
  const pre = handleOptions(event);
  if (pre) return pre;

  const method =
    event?.requestContext?.http?.method ||
    event?.httpMethod ||
    "GET";
  const path = event?.rawPath || event?.path || "";

  if (method === "GET") return handleGet(event);
  if (method === "POST" && /\/save\b/.test(path)) return handleSave(event);
  if (method === "POST") return handleSave(event);

  return error(405, "METHOD_NOT_ALLOWED", `Method ${method} not allowed.`);
};

async function handleGet(event) {
  const sessionId =
    event?.pathParameters?.sessionId ||
    event?.queryStringParameters?.sessionId;

  if (!sessionId) return error(400, "MISSING_SESSION", "sessionId is required.");

  const session = await getSession(sessionId);
  if (!session) return error(404, "SESSION_NOT_FOUND", "Session has expired or does not exist.");

  return ok({
    sessionId: session.sessionId,
    status: session.status,
    language: session.language,
    completionPercent: session.completionPercent || 0,
    answers: parseJson(session.answers, []),
    sections: parseJson(session.sections, []),
    createdAt: session.createdAt,
    expiresAt: session.expiresAt
      ? new Date(session.expiresAt * 1000).toISOString()
      : null,
  });
}

async function handleSave(event) {
  const body = parseBody(event);
  const { sessionId, answers, completionPercent } = body;

  if (!sessionId) return error(400, "MISSING_SESSION", "sessionId is required.");
  if (!Array.isArray(answers)) {
    return error(400, "INVALID_ANSWERS", "answers must be an array.");
  }

  const existing = await getSession(sessionId);
  if (!existing) return error(404, "SESSION_NOT_FOUND", "Session has expired or does not exist.");

  const computed =
    typeof completionPercent === "number"
      ? completionPercent
      : computePercent(answers);

  await updateSession(sessionId, {
    answers: JSON.stringify(answers),
    completionPercent: computed,
    status: computed >= 100 ? "complete" : "in_progress",
  });

  return ok({ sessionId, saved: true, completionPercent: computed });
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function computePercent(answers) {
  if (!answers || answers.length === 0) return 0;
  const confirmed = answers.filter((a) => a.confirmed).length;
  return Math.round((confirmed / answers.length) * 100);
}
