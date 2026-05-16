const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

export function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
    body: JSON.stringify(body),
  };
}

export function ok(body) {
  return json(200, body);
}

export function error(statusCode, code, message) {
  return json(statusCode, { error: code, message });
}

export function preflight() {
  return { statusCode: 204, headers: CORS_HEADERS, body: "" };
}

export function handleOptions(event) {
  if (event?.requestContext?.http?.method === "OPTIONS" || event?.httpMethod === "OPTIONS") {
    return preflight();
  }
  return null;
}

export function parseBody(event) {
  if (!event?.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf-8")
    : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
