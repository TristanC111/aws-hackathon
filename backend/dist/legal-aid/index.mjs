import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);

// lambdas/legal-aid/index.mjs
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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
function preflight() {
  return { statusCode: 204, headers: CORS_HEADERS, body: "" };
}
function handleOptions(event) {
  if (event?.requestContext?.http?.method === "OPTIONS" || event?.httpMethod === "OPTIONS") {
    return preflight();
  }
  return null;
}

// lambdas/legal-aid/index.mjs
var here = dirname(fileURLToPath(import.meta.url));
var CANDIDATES = [
  join(here, "legalAid.json"),
  join(here, "..", "..", "shared", "legalAid.json")
];
var cache = null;
var handler = async (event) => {
  const pre = handleOptions(event);
  if (pre) return pre;
  const params = event?.queryStringParameters || {};
  const country = (params.country || "").toUpperCase();
  const language = (params.language || "").toLowerCase();
  const all = await loadData();
  let orgs = all.organizations;
  if (country) orgs = orgs.filter((o) => o.country === country);
  if (language) orgs = orgs.filter((o) => o.languages.includes(language));
  if (orgs.length === 0 && language) {
    orgs = all.organizations.filter((o) => o.languages.includes(language)).slice(0, 3);
  }
  if (orgs.length === 0) orgs = all.organizations.slice(0, 3);
  return ok({ organizations: orgs });
};
async function loadData() {
  if (cache) return cache;
  const path = CANDIDATES.find((p) => existsSync(p));
  if (!path) throw new Error(`legalAid.json not found in ${CANDIDATES.join(" or ")}`);
  cache = JSON.parse(await readFile(path, "utf-8"));
  return cache;
}
export {
  handler
};
