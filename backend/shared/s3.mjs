import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const region = process.env.AWS_REGION || "us-east-1";
const bucket = process.env.S3_BUCKET || "refugeaid-docs";

export const s3 = new S3Client({ region });

export async function putObject(key, body, contentType) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return { bucket, key };
}

export async function getObject(key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export async function presignDownload(key, expiresSeconds = 3600) {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: expiresSeconds });
}

export function uploadKey(sessionId) {
  return `uploads/${sessionId}.pdf`;
}

export function draftKey(sessionId) {
  return `drafts/${sessionId}.pdf`;
}

export { bucket as BUCKET };
