import {
  TextractClient,
  DetectDocumentTextCommand,
  StartDocumentTextDetectionCommand,
  GetDocumentTextDetectionCommand,
} from "@aws-sdk/client-textract";

const region = process.env.AWS_REGION || "us-east-1";
const bucket = process.env.S3_BUCKET || "refugeaid-docs";

export const textract = new TextractClient({ region });

// Synchronous detection — works for single-page PDFs <5MB.
// For multi-page we use the async API below.
export async function detectTextSync(pdfBytes) {
  const res = await textract.send(
    new DetectDocumentTextCommand({ Document: { Bytes: pdfBytes } })
  );
  return blocksToText(res.Blocks || []);
}

// Async detection — required for multi-page PDFs.
// Caller passes the S3 key of an already-uploaded PDF.
export async function detectTextAsync(s3Key, { pollMs = 1500, maxWaitMs = 60000 } = {}) {
  const start = await textract.send(
    new StartDocumentTextDetectionCommand({
      DocumentLocation: { S3Object: { Bucket: bucket, Name: s3Key } },
    })
  );
  const jobId = start.JobId;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    await sleep(pollMs);
    const status = await textract.send(
      new GetDocumentTextDetectionCommand({ JobId: jobId })
    );
    if (status.JobStatus === "SUCCEEDED") {
      const allBlocks = [...(status.Blocks || [])];
      let next = status.NextToken;
      while (next) {
        const page = await textract.send(
          new GetDocumentTextDetectionCommand({ JobId: jobId, NextToken: next })
        );
        allBlocks.push(...(page.Blocks || []));
        next = page.NextToken;
      }
      return blocksToText(allBlocks);
    }
    if (status.JobStatus === "FAILED") {
      throw new Error(`Textract job failed: ${status.StatusMessage || "unknown"}`);
    }
  }
  throw new Error("Textract job timed out");
}

function blocksToText(blocks) {
  const lines = blocks.filter((b) => b.BlockType === "LINE");
  const pageCount = Math.max(1, ...blocks.map((b) => b.Page || 1));
  const pages = Array.from({ length: pageCount }, () => []);
  for (const line of lines) {
    const p = (line.Page || 1) - 1;
    pages[p].push(line.Text || "");
  }
  return {
    fullText: pages.map((p) => p.join("\n")).join("\n\n"),
    pages: pages.map((p) => p.join("\n")),
    pageCount,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
