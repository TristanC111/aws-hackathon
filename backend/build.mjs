#!/usr/bin/env node
// Bundle every Lambda into dist/<name>/ with index.mjs + assets, then zip.
//
// Run: node build.mjs
// Output: dist/<lambda>.zip per Lambda, ready to upload to AWS.

import { build } from "esbuild";
import { mkdir, rm, cp, writeFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const lambdasDir = join(here, "lambdas");
const promptsDir = join(here, "prompts");
const legalAidJson = join(here, "shared", "legalAid.json");
const distDir = join(here, "dist");

const LAMBDAS = [
  { name: "upload", needs: [] },
  { name: "analyze", needs: ["prompts"] },
  { name: "form-suggest", needs: ["prompts"] },
  { name: "generate-draft", needs: [] },
  { name: "session", needs: [] },
  { name: "legal-aid", needs: ["legalAid"] },
];

// AWS Lambda Node 20 runtime already includes these — exclude them from the
// bundle to keep zips small.
const EXTERNAL = [
  "@aws-sdk/*",
];

async function main() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  for (const lambda of LAMBDAS) {
    await buildOne(lambda);
  }
  console.log("\nAll lambdas built in dist/");
}

async function buildOne({ name, needs }) {
  const entry = join(lambdasDir, name, "index.mjs");
  if (!existsSync(entry)) {
    console.warn(`skip ${name}: entry not found at ${entry}`);
    return;
  }
  const outDir = join(distDir, name);
  await mkdir(outDir, { recursive: true });

  await build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "esm",
    outfile: join(outDir, "index.mjs"),
    external: EXTERNAL,
    banner: {
      // esbuild's ESM output uses `import` but Node sometimes resolves
      // CommonJS-only deps (e.g. pdf-lib's deps) — this shim lets bundled
      // require() calls work inside an .mjs file.
      js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);",
    },
    logLevel: "info",
  });

  // package.json so Lambda treats index.mjs as ESM (it does anyway because of
  // the .mjs extension, but this is harmless and explicit).
  await writeFile(
    join(outDir, "package.json"),
    JSON.stringify({ type: "module" }, null, 2)
  );

  // Copy runtime assets that the bundle reads via fs.readFile.
  if (needs.includes("prompts")) {
    await cp(promptsDir, join(outDir, "prompts"), { recursive: true });
  }
  if (needs.includes("legalAid")) {
    await cp(legalAidJson, join(outDir, "legalAid.json"));
  }

  // Zip it. We use the system `zip` for portability — every macOS and most
  // Linux installs have it. CI without zip can install via apt/brew.
  const zipPath = join(distDir, `${name}.zip`);
  await rm(zipPath, { force: true });
  await run("zip", ["-r", "-q", zipPath, "."], { cwd: outDir });

  const size = (await stat(zipPath)).size;
  console.log(`✓ ${name}.zip (${(size / 1024).toFixed(1)} KB)`);
}

function run(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", ...opts });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))
    );
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
