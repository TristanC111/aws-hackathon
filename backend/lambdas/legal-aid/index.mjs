import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ok, handleOptions } from "../../shared/response.mjs";

const here = dirname(fileURLToPath(import.meta.url));

// After bundling: legalAid.json sits next to index.mjs at /var/task/legalAid.json.
// In local dev: it lives at backend/shared/legalAid.json.
const CANDIDATES = [
  join(here, "legalAid.json"),
  join(here, "..", "..", "shared", "legalAid.json"),
];

let cache = null;

export const handler = async (event) => {
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
