import "server-only";

// Résumé file storage on Amazon S3. Enabled when S3_BUCKET is set (preprod/prod);
// when it isn't (local dev), callers fall back to storing bytes in Postgres.
// Credentials come from the EC2 instance IAM role by default (nothing to set);
// static keys are only used if AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are set.

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const bucket = process.env.S3_BUCKET;
const region =
  process.env.S3_REGION || process.env.AWS_REGION || "ap-south-1";

let client: S3Client | undefined;
function s3(): S3Client {
  if (!client) {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    client = new S3Client({
      region,
      // Omit `credentials` so the SDK uses the instance role / default chain.
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
  }
  return client;
}

/** True when S3 is configured (a bucket is set). */
export function isS3Configured(): boolean {
  return !!bucket;
}

export async function putResumeObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getResumeObject(
  key: string,
): Promise<{ body: Buffer; contentType?: string }> {
  const res = await s3().send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  const bytes = await res.Body!.transformToByteArray();
  return { body: Buffer.from(bytes), contentType: res.ContentType };
}

export async function deleteResumeObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
