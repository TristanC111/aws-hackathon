import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

// After esbuild bundling, `here` is the Lambda deployment root (/var/task) and
// prompt files live next to index.mjs in ./prompts/. In local dev (running raw
// .mjs files), `here` is backend/shared/ and the files live at ../prompts/.
const CANDIDATES = [join(here, "prompts"), join(here, "..", "prompts")];

const cache = new Map();

export async function loadPrompt(name) {
  if (cache.has(name)) return cache.get(name);
  const dir = CANDIDATES.find((p) => existsSync(p));
  if (!dir) throw new Error(`Could not find prompts directory in ${CANDIDATES.join(" or ")}`);
  const text = await readFile(join(dir, `${name}.txt`), "utf-8");
  cache.set(name, text);
  return text;
}
