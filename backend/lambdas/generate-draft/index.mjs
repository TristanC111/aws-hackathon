import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getSession, updateSession } from "../../shared/dynamo.mjs";
import { putObject, presignDownload, draftKey } from "../../shared/s3.mjs";
import { ok, error, handleOptions, parseBody } from "../../shared/response.mjs";

export const handler = async (event) => {
  const pre = handleOptions(event);
  if (pre) return pre;

  const body = parseBody(event);
  const { sessionId, language } = body;

  if (!sessionId) return error(400, "MISSING_SESSION", "sessionId is required.");

  const session = await getSession(sessionId);
  if (!session) return error(404, "SESSION_NOT_FOUND", "Session has expired or does not exist.");

  const answers = parseJsonField(session.answers, []);
  const sections = parseJsonField(session.sections, []);
  const targetLang = (language || session.language || "en").toLowerCase();
  const documentTitle = session.documentTitle || "Immigration Form Draft";

  const flagged = sections
    .filter((s) => s.riskLevel === "high")
    .map((s) => ({
      sectionId: s.sectionId,
      message:
        "This section was flagged as legally sensitive. Please review with a legal aid advisor before submitting.",
    }));

  const pdfBytes = await renderDraftPdf({ documentTitle, answers, flagged, language: targetLang });
  const key = draftKey(sessionId);

  try {
    await putObject(key, pdfBytes, "application/pdf");
  } catch (e) {
    console.error("S3 putObject failed", e);
    return error(500, "STORAGE_FAILED", "Could not store the generated draft.");
  }

  const downloadUrl = await presignDownload(key, 3600);
  const completionPercent = computeCompletion(answers);

  await updateSession(sessionId, {
    status: "complete",
    completionPercent,
    draftKey: key,
  });

  return ok({
    sessionId,
    downloadUrl,
    expiresIn: 3600,
    completionPercent,
    flaggedSections: flagged,
  });
};

function parseJsonField(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function computeCompletion(answers) {
  if (!answers || answers.length === 0) return 0;
  const confirmed = answers.filter((a) => a.confirmed).length;
  return Math.round((confirmed / answers.length) * 100);
}

async function renderDraftPdf({ documentTitle, answers, flagged }) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const MARGIN = 50;
  const PAGE_WIDTH = 612;
  const PAGE_HEIGHT = 792;
  const MAX_WIDTH = PAGE_WIDTH - MARGIN * 2;

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const newPageIfNeeded = (needed) => {
    if (y - needed < MARGIN) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  const drawText = (text, options = {}) => {
    const f = options.bold ? bold : font;
    const size = options.size || 11;
    const color = options.color || rgb(0, 0, 0);
    const lines = wrap(text, f, size, MAX_WIDTH);
    for (const line of lines) {
      newPageIfNeeded(size + 4);
      page.drawText(line, { x: MARGIN, y, size, font: f, color });
      y -= size + 4;
    }
  };

  // Header
  drawText(documentTitle, { size: 18, bold: true });
  y -= 6;
  drawText("RefugeAid — Draft form for review.", { size: 10, color: rgb(0.3, 0.3, 0.3) });
  drawText(
    "This is a draft. It has NOT been submitted. Review carefully and consult a legal aid advisor before signing.",
    { size: 10, color: rgb(0.6, 0.2, 0.0) }
  );
  y -= 10;

  // Answers
  drawText("Your answers", { size: 14, bold: true });
  y -= 4;

  if (answers.length === 0) {
    drawText("(No answers recorded yet.)", { size: 11, color: rgb(0.4, 0.4, 0.4) });
  } else {
    for (const a of answers) {
      newPageIfNeeded(40);
      drawText(a.fieldLabel || a.fieldId || "Field", { size: 11, bold: true });
      drawText(String(a.userAnswer ?? "(left blank)"), { size: 11 });
      if (!a.confirmed) {
        drawText("[ Not yet confirmed by user ]", { size: 9, color: rgb(0.6, 0.2, 0.0) });
      }
      y -= 6;
    }
  }

  // Flagged sections reminder
  if (flagged.length > 0) {
    y -= 10;
    drawText("Sections flagged for legal review", { size: 13, bold: true, color: rgb(0.6, 0.2, 0.0) });
    for (const f of flagged) {
      drawText(`• ${f.sectionId}: ${f.message}`, { size: 10, color: rgb(0.6, 0.2, 0.0) });
    }
  }

  return pdf.save();
}

// Word-wrap by measured width. Falls back to character-wise split for tokens
// longer than the line (rare, e.g. URLs).
function wrap(text, font, size, maxWidth) {
  const lines = [];
  for (const paragraph of String(text).split(/\r?\n/)) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const tentative = line ? line + " " + word : word;
      if (font.widthOfTextAtSize(safeText(tentative), size) <= maxWidth) {
        line = tentative;
      } else {
        if (line) lines.push(safeText(line));
        if (font.widthOfTextAtSize(safeText(word), size) > maxWidth) {
          let chunk = "";
          for (const ch of word) {
            if (font.widthOfTextAtSize(safeText(chunk + ch), size) > maxWidth) {
              lines.push(safeText(chunk));
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          line = chunk;
        } else {
          line = word;
        }
      }
    }
    if (line) lines.push(safeText(line));
  }
  return lines;
}

// Standard PDF fonts only support WinAnsi. Strip non-encodable characters so
// drawing doesn't throw on Arabic/Cyrillic/etc. The draft PDF is a working
// copy — for production we'd embed a Unicode font.
function safeText(text) {
  return String(text).replace(/[^\x20-\x7E]/g, "?");
}
