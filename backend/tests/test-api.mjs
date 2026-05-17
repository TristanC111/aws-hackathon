#!/usr/bin/env node
// End-to-end API tests for the RefugeAid backend.
//
// Usage:
//   node tests/test-api.mjs https://<api-id>.execute-api.us-east-1.amazonaws.com
//   API_URL=https://... node tests/test-api.mjs
//
// Flags:
//   --skip-slow     skip /analyze and /generate-draft (which call Bedrock/Textract)
//   --pdf=path.pdf  use your own PDF instead of a generated one
//
// Requires Node 20+ (uses built-in fetch + FormData + Blob).

import { readFile } from "node:fs/promises";
import { PDFDocument, StandardFonts } from "pdf-lib";

// ─── config ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));
const pdfFlag = args.find((a) => a.startsWith("--pdf="))?.slice(6);
const SKIP_SLOW = flags.has("--skip-slow");

const API_URL = (positional[0] || process.env.API_URL || "").replace(/\/$/, "");
if (!API_URL) {
  console.error("Usage: node tests/test-api.mjs <api-url>");
  console.error("   or: API_URL=<api-url> node tests/test-api.mjs");
  process.exit(1);
}

// ─── mini test framework ──────────────────────────────────────────────────

const COLORS = {
  reset: "\x1b[0m",
  gray: "\x1b[90m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

const results = [];
const state = {}; // shared between tests (sessionId etc.)

async function test(name, fn) {
  const start = Date.now();
  process.stdout.write(`${COLORS.gray}  ▸${COLORS.reset} ${name} ... `);
  try {
    await fn();
    const ms = Date.now() - start;
    process.stdout.write(`${COLORS.green}✓${COLORS.reset} ${COLORS.gray}(${ms}ms)${COLORS.reset}\n`);
    results.push({ name, ok: true, ms });
  } catch (err) {
    const ms = Date.now() - start;
    process.stdout.write(`${COLORS.red}✗${COLORS.reset} ${COLORS.gray}(${ms}ms)${COLORS.reset}\n`);
    console.error(`    ${COLORS.red}${err.message}${COLORS.reset}`);
    if (err.detail) console.error(`    ${COLORS.gray}${JSON.stringify(err.detail)}${COLORS.reset}`);
    results.push({ name, ok: false, ms, err });
  }
}

function group(name) {
  console.log(`\n${COLORS.bold}${COLORS.cyan}${name}${COLORS.reset}`);
}

class TestError extends Error {
  constructor(message, detail) {
    super(message);
    this.detail = detail;
  }
}

function assert(cond, message, detail) {
  if (!cond) throw new TestError(message, detail);
}

function assertEq(actual, expected, message) {
  if (actual !== expected) {
    throw new TestError(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ─── http helpers ─────────────────────────────────────────────────────────

async function getJson(path) {
  const res = await fetch(`${API_URL}${path}`);
  const body = await safeJson(res);
  return { status: res.status, body };
}

async function postJson(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const respBody = await safeJson(res);
  return { status: res.status, body: respBody };
}

async function postMultipart(path, fields) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v instanceof Blob) fd.append(k, v, v.name || "file.pdf");
    else fd.append(k, v);
  }
  const res = await fetch(`${API_URL}${path}`, { method: "POST", body: fd });
  const respBody = await safeJson(res);
  return { status: res.status, body: respBody };
}

async function safeJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

// ─── test pdf generator ───────────────────────────────────────────────────

async function buildTestPdf() {
  if (pdfFlag) {
    const buf = await readFile(pdfFlag);
    return new Blob([buf], { type: "application/pdf" });
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([612, 792]);
  const draw = (text, y, opts = {}) =>
    page.drawText(text, { x: 50, y, size: opts.size || 11, font: opts.bold ? bold : font });

  draw("Form I-589, Application for Asylum and Withholding of Removal", 740, { size: 14, bold: true });
  draw("Part A.I. Information About You", 700, { size: 12, bold: true });
  draw("1. Your Full Name (Last, First, Middle)", 670);
  draw("2. Date of Birth (Month/Day/Year)", 650);
  draw("3. Country of Birth", 630);
  draw("4. Country of Citizenship", 610);
  draw("Part B. Information About Your Application", 570, { size: 12, bold: true });
  draw("Have you, your spouse, or your child ever experienced harm or", 540);
  draw("threats of harm in your country of nationality or last residence?", 525);
  draw("If yes, describe the harm in detail. This information is", 505);
  draw("legally sensitive and may affect your asylum case.", 490);
  draw("Part C. Additional Information", 450, { size: 12, bold: true });
  draw("Have you or any member of your family ever been arrested,", 420);
  draw("charged, or convicted of any crime in any country?", 405);

  const bytes = await pdf.save();
  return new Blob([bytes], { type: "application/pdf" });
}

// ─── tests ────────────────────────────────────────────────────────────────

async function main() {
  console.log(`${COLORS.bold}Testing API:${COLORS.reset} ${API_URL}`);
  if (SKIP_SLOW) console.log(`${COLORS.yellow}(skipping slow Bedrock/Textract tests)${COLORS.reset}`);

  group("Legal aid (no auth, no body — fastest sanity check)");

  await test("GET /legal-aid returns organizations", async () => {
    const { status, body } = await getJson("/legal-aid");
    assertEq(status, 200, "status");
    assert(Array.isArray(body?.organizations), "organizations should be an array", body);
    assert(body.organizations.length > 0, "should return at least one org", body);
  });

  await test("GET /legal-aid filters by country", async () => {
    const { status, body } = await getJson("/legal-aid?country=US");
    assertEq(status, 200, "status");
    assert(body.organizations.every((o) => o.country === "US"), "all orgs should be US", body);
  });

  await test("GET /legal-aid filters by language", async () => {
    const { status, body } = await getJson("/legal-aid?language=ar");
    assertEq(status, 200, "status");
    assert(
      body.organizations.every((o) => o.languages.includes("ar")),
      "all orgs should support Arabic",
      body
    );
  });

  group("Upload (validation + happy path)");

  await test("POST /upload rejects missing file", async () => {
    const { status, body } = await postMultipart("/upload", { language: "ar" });
    assertEq(status, 400, "status");
    assertEq(body?.error, "MISSING_FILE", "error code");
  });

  await test("POST /upload rejects missing language", async () => {
    const pdf = await buildTestPdf();
    const { status, body } = await postMultipart("/upload", { file: pdf });
    assertEq(status, 400, "status");
    assertEq(body?.error, "MISSING_LANGUAGE", "error code");
  });

  await test("POST /upload rejects unsupported language", async () => {
    const pdf = await buildTestPdf();
    const { status, body } = await postMultipart("/upload", { file: pdf, language: "zz" });
    assertEq(status, 400, "status");
    assertEq(body?.error, "UNSUPPORTED_LANGUAGE", "error code");
  });

  await test("POST /upload rejects non-PDF", async () => {
    const txt = new Blob(["hello"], { type: "text/plain" });
    txt.name = "hello.txt";
    const { status, body } = await postMultipart("/upload", { file: txt, language: "ar" });
    assertEq(status, 400, "status");
    assertEq(body?.error, "INVALID_FILE_TYPE", "error code");
  });

  await test("POST /upload accepts a valid PDF", async () => {
    const pdf = await buildTestPdf();
    const { status, body } = await postMultipart("/upload", { file: pdf, language: "ar" });
    assertEq(status, 200, "status");
    assert(body?.sessionId, "should return sessionId", body);
    assertEq(body.status, "uploaded", "session status");
    state.sessionId = body.sessionId;
    console.log(`    ${COLORS.gray}sessionId: ${body.sessionId}${COLORS.reset}`);
  });

  group("Session retrieval");

  await test("GET /session/{id} returns the new session", async () => {
    assert(state.sessionId, "need sessionId from upload test");
    const { status, body } = await getJson(`/session/${state.sessionId}`);
    assertEq(status, 200, "status");
    assertEq(body.sessionId, state.sessionId, "sessionId echo");
    assertEq(body.language, "ar", "language");
  });

  await test("GET /session/nonexistent returns 404", async () => {
    const { status, body } = await getJson(`/session/00000000-0000-0000-0000-000000000000`);
    assertEq(status, 404, "status");
    assertEq(body?.error, "SESSION_NOT_FOUND", "error code");
  });

  group("Analyze (slow — Textract + Translate + Bedrock)");

  if (SKIP_SLOW) {
    console.log(`  ${COLORS.gray}skipped${COLORS.reset}`);
  } else {
    await test("POST /analyze returns sections with risk levels", async () => {
      assert(state.sessionId, "need sessionId from upload test");
      const { status, body } = await postJson("/analyze", {
        sessionId: state.sessionId,
        language: "ar",
      });
      assertEq(status, 200, "status");
      assert(Array.isArray(body.sections), "sections should be array", body);
      assert(body.sections.length > 0, "should have sections", body);
      assert(body.totalSections > 0, "totalSections > 0", body);

      const first = body.sections[0];
      assert(first.sectionId, "section has sectionId", first);
      assert(first.originalText, "section has originalText", first);
      assert(first.plainExplanation, "section has plainExplanation", first);
      assert(["high", "medium", "low"].includes(first.riskLevel), "valid riskLevel", first);

      const highRisk = body.sections.filter((s) => s.riskLevel === "high");
      assert(
        highRisk.every((s) => s.safeToSuggest === false),
        "high-risk sections must have safeToSuggest=false",
        highRisk
      );
      assert(
        highRisk.every((s) => s.suggestedAnswer === null),
        "high-risk sections must have suggestedAnswer=null",
        highRisk
      );

      state.sections = body.sections;
      console.log(
        `    ${COLORS.gray}${body.totalSections} sections, ${body.highRiskCount} high-risk${COLORS.reset}`
      );
    });
  }

  await test("POST /analyze rejects missing sessionId", async () => {
    const { status, body } = await postJson("/analyze", { language: "ar" });
    assertEq(status, 400, "status");
    assertEq(body?.error, "MISSING_SESSION", "error code");
  });

  await test("POST /analyze rejects bad sessionId", async () => {
    const { status, body } = await postJson("/analyze", {
      sessionId: "00000000-0000-0000-0000-000000000000",
      language: "ar",
    });
    assertEq(status, 404, "status");
    assertEq(body?.error, "SESSION_NOT_FOUND", "error code");
  });

  group("Form-suggest (Bedrock per-field)");

  if (SKIP_SLOW) {
    console.log(`  ${COLORS.gray}skipped${COLORS.reset}`);
  } else {
    await test("POST /form-suggest returns a suggestion", async () => {
      assert(state.sessionId, "need sessionId");
      const { status, body } = await postJson("/form-suggest", {
        sessionId: state.sessionId,
        language: "ar",
        fieldId: "field_001",
        fieldLabel: "Country of Birth",
        fieldDescription: "Enter the country where you were born.",
        conversationHistory: [
          {
            fieldId: "field_000",
            fieldLabel: "Full Name",
            userAnswer: "Ahmad Al-Rashidi",
          },
        ],
      });
      assertEq(status, 200, "status");
      assertEq(body.fieldId, "field_001", "fieldId echo");
      assertEq(body.needsConfirmation, true, "needsConfirmation always true");
      assert(["high", "medium", "low"].includes(body.confidence), "valid confidence");
      assert(["high", "medium", "low"].includes(body.riskLevel), "valid riskLevel");
    });

    await test("POST /form-suggest high-risk field returns no value", async () => {
      assert(state.sessionId, "need sessionId");
      const { status, body } = await postJson("/form-suggest", {
        sessionId: state.sessionId,
        language: "ar",
        fieldId: "field_persecution",
        fieldLabel: "Describe any persecution you have suffered",
        fieldDescription: "Include details about who harmed you and why.",
        conversationHistory: [],
      });
      assertEq(status, 200, "status");
      if (body.riskLevel === "high") {
        assertEq(body.suggestedValue, null, "high-risk must not suggest a value");
      }
    });
  }

  await test("POST /form-suggest rejects missing fieldId", async () => {
    const { status, body } = await postJson("/form-suggest", {
      sessionId: state.sessionId || "x",
    });
    assert(status === 400 || status === 404, "should fail validation or auth", { status, body });
  });

  group("Session save");

  await test("POST /session/save stores answers", async () => {
    assert(state.sessionId, "need sessionId");
    const { status, body } = await postJson("/session/save", {
      sessionId: state.sessionId,
      answers: [
        { fieldId: "f1", fieldLabel: "Full Name", userAnswer: "Ahmad Al-Rashidi", confirmed: true },
        { fieldId: "f2", fieldLabel: "Date of Birth", userAnswer: "1990-03-15", confirmed: true },
        { fieldId: "f3", fieldLabel: "Country of Birth", userAnswer: "Syria", confirmed: false },
      ],
      completionPercent: 67,
    });
    assertEq(status, 200, "status");
    assertEq(body.saved, true, "saved");
    assertEq(body.completionPercent, 67, "completionPercent");
  });

  await test("GET /session/{id} now shows saved answers", async () => {
    const { status, body } = await getJson(`/session/${state.sessionId}`);
    assertEq(status, 200, "status");
    assertEq(body.completionPercent, 67, "completionPercent persists");
    assert(Array.isArray(body.answers) && body.answers.length === 3, "answers persist", body.answers);
  });

  group("Generate draft");

  if (SKIP_SLOW) {
    console.log(`  ${COLORS.gray}skipped${COLORS.reset}`);
  } else {
    await test("POST /generate-draft returns a download URL", async () => {
      assert(state.sessionId, "need sessionId");
      const { status, body } = await postJson("/generate-draft", {
        sessionId: state.sessionId,
        language: "ar",
      });
      assertEq(status, 200, "status");
      assert(body.downloadUrl?.startsWith("https://"), "downloadUrl should be https", body);
      assert(body.expiresIn > 0, "expiresIn > 0", body);
      assert(Array.isArray(body.flaggedSections), "flaggedSections is array", body);
      state.downloadUrl = body.downloadUrl;
    });

    await test("Draft PDF is downloadable", async () => {
      assert(state.downloadUrl, "need downloadUrl");
      const res = await fetch(state.downloadUrl);
      assertEq(res.status, 200, "S3 status");
      const buf = Buffer.from(await res.arrayBuffer());
      assert(buf.slice(0, 4).toString() === "%PDF", "response is a PDF", {
        firstBytes: buf.slice(0, 8).toString("hex"),
      });
      console.log(`    ${COLORS.gray}${(buf.length / 1024).toFixed(1)} KB PDF${COLORS.reset}`);
    });
  }

  // ─── summary ─────────────────────────────────────────────────────────────

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const totalMs = results.reduce((a, r) => a + r.ms, 0);

  console.log(`\n${COLORS.bold}Summary${COLORS.reset}`);
  console.log(`  ${COLORS.green}passed: ${passed}${COLORS.reset}`);
  if (failed > 0) console.log(`  ${COLORS.red}failed: ${failed}${COLORS.reset}`);
  console.log(`  ${COLORS.gray}total: ${(totalMs / 1000).toFixed(1)}s${COLORS.reset}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(`\n${COLORS.red}Fatal:${COLORS.reset}`, e);
  process.exit(2);
});
