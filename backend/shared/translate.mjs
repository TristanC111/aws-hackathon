import {
  TranslateClient,
  TranslateTextCommand,
} from "@aws-sdk/client-translate";

const region = process.env.AWS_REGION || "us-east-1";
export const translate = new TranslateClient({ region });

// AWS Translate caps a single request at 10,000 bytes of UTF-8.
const MAX_CHUNK_BYTES = 9000;

export async function translateText(text, { from = "auto", to }) {
  if (!text || !text.trim()) return { text: "", detectedLanguage: from };
  if (from === to) return { text, detectedLanguage: from };

  const chunks = chunkByBytes(text, MAX_CHUNK_BYTES);
  const out = [];
  let detected = from;

  for (const chunk of chunks) {
    const res = await translate.send(
      new TranslateTextCommand({
        Text: chunk,
        SourceLanguageCode: from,
        TargetLanguageCode: to,
      })
    );
    out.push(res.TranslatedText || "");
    if (res.SourceLanguageCode) detected = res.SourceLanguageCode;
  }

  return { text: out.join(""), detectedLanguage: detected };
}

function chunkByBytes(text, limit) {
  const enc = new TextEncoder();
  const bytes = enc.encode(text);
  if (bytes.length <= limit) return [text];

  const chunks = [];
  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Back off to the last newline or space so we don't split mid-word/sentence.
    if (end < bytes.length) {
      const slice = bytes.slice(start, end);
      const text = new TextDecoder().decode(slice);
      const lastBreak = Math.max(text.lastIndexOf("\n"), text.lastIndexOf(". "));
      if (lastBreak > limit / 2) {
        const trimmed = text.slice(0, lastBreak + 1);
        chunks.push(trimmed);
        start += enc.encode(trimmed).length;
        continue;
      }
    }
    chunks.push(new TextDecoder().decode(bytes.slice(start, end)));
    start = end;
  }
  return chunks;
}
