// Split a document's full text into reasonable "sections" for analysis.
// Heuristic-only — official immigration forms label parts as "Part A", "Part I",
// "Section 1", or use numbered headings. We split on those markers and fall
// back to paragraph-grouped chunks so the analyzer always sees sensible units.

const HEADER_RE = /^(?:Part\s+[A-Z0-9.IVX]+|Section\s+\d+|[A-Z][A-Z ]{4,}|\d+\.\s+[A-Z])/;
const MAX_SECTION_CHARS = 1800;
const MIN_SECTION_CHARS = 80;

export function splitIntoSections(fullText) {
  if (!fullText || !fullText.trim()) return [];

  const lines = fullText.split(/\r?\n/);
  const sections = [];
  let current = [];

  const flush = () => {
    const text = current.join("\n").trim();
    if (text.length >= MIN_SECTION_CHARS) sections.push(text);
    else if (text.length > 0 && sections.length > 0) {
      // attach short trailing fragments to previous section
      sections[sections.length - 1] += "\n" + text;
    }
    current = [];
  };

  for (const line of lines) {
    if (HEADER_RE.test(line.trim()) && current.length > 0) {
      flush();
    }
    current.push(line);
    if (current.join("\n").length > MAX_SECTION_CHARS) flush();
  }
  flush();

  // Fallback: if heuristic produced one big blob, chunk it by paragraphs.
  if (sections.length <= 1 && fullText.length > MAX_SECTION_CHARS) {
    return chunkByParagraphs(fullText);
  }

  return sections.map((text, index) => ({
    sectionId: `sec_${String(index + 1).padStart(3, "0")}`,
    index,
    text,
  }));
}

function chunkByParagraphs(text) {
  const paragraphs = text.split(/\n\s*\n/);
  const out = [];
  let buf = "";
  for (const p of paragraphs) {
    if ((buf + "\n\n" + p).length > MAX_SECTION_CHARS && buf.length > 0) {
      out.push(buf.trim());
      buf = p;
    } else {
      buf = buf ? buf + "\n\n" + p : p;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.map((t, index) => ({
    sectionId: `sec_${String(index + 1).padStart(3, "0")}`,
    index,
    text: t,
  }));
}
