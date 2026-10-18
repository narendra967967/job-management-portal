import "server-only";

// File storage for user uploads (résumés today; attachments later).
//
// Driver, picked at runtime:
//   STORAGE_DRIVER=local  → files on disk under UPLOADS_DIR (the VPS; a Docker volume)
//   else                  → bytes in Postgres (resume_files) — local dev
//
// Each résumé row records where ITS file lives in `resumes.blob_url`, so rows
// written by any driver stay readable after the driver changes:
//   "local:<key>" → disk     "db" → resume_files     "pending" → not stored yet
//   anything else → unreadable (legacy S3 keys; all were moved to disk at the AWS cutover)
//
// Files on disk are private: never served by Nginx, only streamed back through
// the signed-in download action after an ownership check.

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { resumeFiles } from "@/db/schema";

const LOCAL_PREFIX = "local:";

function uploadsDir(): string {
  return path.resolve(process.env.UPLOADS_DIR || "/data/uploads");
}

function isLocalDriver(): boolean {
  return process.env.STORAGE_DRIVER === "local";
}

/** Absolute path for a storage key, refusing anything that escapes UPLOADS_DIR. */
function resolveKey(key: string): string {
  const base = uploadsDir();
  const full = path.resolve(base, key);
  if (!full.startsWith(base + path.sep)) throw new Error("Invalid storage key.");
  return full;
}

async function putLocal(key: string, bytes: Buffer): Promise<void> {
  const full = resolveKey(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  // Write to a temp file, then rename — never leaves a half-written file behind.
  const tmp = `${full}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, bytes, { mode: 0o640 });
  await fs.rename(tmp, full);
}

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function contentTypeFor(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/** Store a résumé's bytes; returns the `blob_url` value to save on the row. */
export async function storeResumeFile(input: {
  userId: string;
  resumeId: string;
  ext: string;
  bytes: Buffer;
  contentType: string;
}): Promise<string> {
  const key = `resumes/${input.userId}/${input.resumeId}.${input.ext}`;
  if (isLocalDriver()) {
    await putLocal(key, input.bytes);
    return LOCAL_PREFIX + key;
  }
  await db.insert(resumeFiles).values({
    resumeId: input.resumeId,
    userId: input.userId,
    contentType: input.contentType,
    data: input.bytes,
  });
  return "db";
}

/** Read a résumé's bytes from wherever its row says they live; null if missing. */
export async function readResumeFile(
  blobUrl: string,
  resumeId: string,
  userId: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  if (blobUrl.startsWith(LOCAL_PREFIX)) {
    const key = blobUrl.slice(LOCAL_PREFIX.length);
    try {
      return { body: await fs.readFile(resolveKey(key)), contentType: contentTypeFor(key) };
    } catch {
      return null;
    }
  }
  if (blobUrl === "db") {
    const [f] = await db
      .select({ contentType: resumeFiles.contentType, data: resumeFiles.data })
      .from(resumeFiles)
      .where(and(eq(resumeFiles.resumeId, resumeId), eq(resumeFiles.userId, userId)));
    return f ? { body: f.data, contentType: f.contentType } : null;
  }
  return null;
}

/** Best-effort removal of a résumé's stored bytes (DB copies cascade with the row). */
export async function deleteResumeFile(blobUrl: string): Promise<void> {
  try {
    if (blobUrl.startsWith(LOCAL_PREFIX)) {
      await fs.rm(resolveKey(blobUrl.slice(LOCAL_PREFIX.length)), { force: true });
    }
  } catch {
    // Orphaned bytes are harmless; never block deleting the résumé itself.
  }
}
