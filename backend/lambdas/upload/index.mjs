import { v4 as uuid } from "uuid";
import multipart from "lambda-multipart-parser";
import { putObject, uploadKey } from "../../shared/s3.mjs";
import { createSession } from "../../shared/dynamo.mjs";
import { ok, error, handleOptions } from "../../shared/response.mjs";

const MAX_BYTES = 5 * 1024 * 1024;
const SUPPORTED_LANGS = new Set([
  "ar", "fa", "ps", "so", "ti", "am", "uk", "es", "fr", "sw", "my", "ku", "en",
  "ru", "tr", "ur", "hi", "bn", "vi", "zh", "pt", "it", "de",
]);

export const handler = async (event) => {
  const pre = handleOptions(event);
  if (pre) return pre;

  let parsed;
  try {
    parsed = await multipart.parse(event);
  } catch (e) {
    return error(400, "INVALID_MULTIPART", "Could not parse multipart upload.");
  }

  const file = (parsed.files || [])[0];
  const language = (parsed.language || "").toLowerCase();

  if (!file) return error(400, "MISSING_FILE", "No file was uploaded.");
  if (!language) return error(400, "MISSING_LANGUAGE", "A language code is required.");
  if (!SUPPORTED_LANGS.has(language)) {
    return error(400, "UNSUPPORTED_LANGUAGE", `Language '${language}' is not supported.`);
  }

  const contentType = (file.contentType || "").toLowerCase();
  const filename = (file.filename || "").toLowerCase();
  if (!contentType.includes("pdf") && !filename.endsWith(".pdf")) {
    return error(400, "INVALID_FILE_TYPE", "Only PDF files are supported.");
  }

  const buf = file.content;
  if (!buf || buf.length === 0) {
    return error(400, "EMPTY_FILE", "Uploaded file is empty.");
  }
  if (buf.length > MAX_BYTES) {
    return error(413, "FILE_TOO_LARGE", "File must be under 5MB.");
  }

  const sessionId = uuid();
  const key = uploadKey(sessionId);

  try {
    await putObject(key, buf, "application/pdf");
  } catch (e) {
    console.error("S3 putObject failed", e);
    return error(500, "STORAGE_FAILED", "Could not store the uploaded document.");
  }

  const pageCount = estimatePdfPageCount(buf);

  try {
    await createSession({
      sessionId,
      language,
      status: "uploaded",
      s3Key: key,
      pageCount,
      completionPercent: 0,
    });
  } catch (e) {
    console.error("DynamoDB createSession failed", e);
    return error(500, "SESSION_FAILED", "Could not start a session.");
  }

  return ok({
    sessionId,
    status: "uploaded",
    pageCount,
    detectedDocumentLanguage: "en",
    message: "Document received. Analysis starting.",
  });
};

// Cheap page count without parsing the whole PDF — counts /Type /Page markers.
function estimatePdfPageCount(buf) {
  try {
    const s = buf.toString("latin1");
    const m = s.match(/\/Type\s*\/Page[^s]/g);
    return m ? m.length : 1;
  } catch {
    return 1;
  }
}
