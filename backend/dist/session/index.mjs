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

// lambdas/session/index.mjs
var handler = async (event) => {
  const pre = handleOptions(event);
  if (pre) return pre;
  const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";
  const path = event?.rawPath || event?.path || "";
  if (method === "GET") return handleGet(event);
  if (method === "POST" && /\/save\b/.test(path)) return handleSave(event);
  if (method === "POST") return handleSave(event);
  return error(405, "METHOD_NOT_ALLOWED", `Method ${method} not allowed.`);
};
async function handleGet(event) {
  const sessionId = event?.pathParameters?.sessionId || event?.queryStringParameters?.sessionId;
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
    expiresAt: session.expiresAt ? new Date(session.expiresAt * 1e3).toISOString() : null
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
  const computed = typeof completionPercent === "number" ? completionPercent : computePercent(answers);
  await updateSession(sessionId, {
    answers: JSON.stringify(answers),
    completionPercent: computed,
    status: computed >= 100 ? "complete" : "in_progress"
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
  return Math.round(confirmed / answers.length * 100);
}
export {
  handler
};
