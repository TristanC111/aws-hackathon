import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const region = process.env.AWS_REGION || "us-east-1";
const table = process.env.DYNAMO_TABLE || "refugeaid-sessions";

const base = new DynamoDBClient({ region });
export const ddb = DynamoDBDocumentClient.from(base, {
  marshallOptions: { removeUndefinedValues: true },
});

const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24h

export async function createSession(session) {
  const now = new Date();
  const item = {
    ...session,
    createdAt: now.toISOString(),
    expiresAt: Math.floor(now.getTime() / 1000) + SESSION_TTL_SECONDS,
  };
  await ddb.send(new PutCommand({ TableName: table, Item: item }));
  return item;
}

export async function getSession(sessionId) {
  const res = await ddb.send(
    new GetCommand({ TableName: table, Key: { sessionId } })
  );
  return res.Item || null;
}

export async function updateSession(sessionId, fields) {
  const entries = Object.entries(fields);
  if (entries.length === 0) return;

  const names = {};
  const values = {};
  const sets = [];
  for (const [k, v] of entries) {
    names[`#${k}`] = k;
    values[`:${k}`] = v;
    sets.push(`#${k} = :${k}`);
  }

  await ddb.send(
    new UpdateCommand({
      TableName: table,
      Key: { sessionId },
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
}

export { table as TABLE };
