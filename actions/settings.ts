"use server";

// Settings Server Actions — persist the Settings page to the DB (Milestone A2).
// The AI API key is encrypted at rest (lib/crypto); only its last 4 chars are
// ever read back to the client (via loadWorkspace).

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/current-user";
import { encryptSecret } from "@/lib/crypto";
import {
  account as accountT,
  gmailConfig as gmailConfigT,
  gmailIngestErrors as errorsT,
  resumes as resumesT,
  resumeFiles as resumeFilesT,
  user as userT,
  userSettings as settingsT,
} from "@/db/schema";
import {
  aiKeySchema,
  aiPromptsSchema,
  aiProviderSchema,
  followUpsSchema,
  gmailConfigSchema,
  parseInput,
  profileSchema,
  resumeTextSchema,
  syncIntervalSchema,
  zId,
} from "@/lib/schemas";
import { z } from "zod";
import { RESUME_MAX_BYTES, type AiProvider } from "@/lib/types";
import { extractResumeText } from "@/lib/resume-extract";

/** Ensure a user_settings row exists, then merge `set` into it. */
async function upsertSettings(userId: string, set: Record<string, unknown>) {
  await db
    .insert(settingsT)
    .values({ userId, ...set })
    .onConflictDoUpdate({ target: settingsT.userId, set });
}

/* ---------------- profile ---------------- */

export async function updateProfileAction(input: {
  name: string;
  email: string;
  mobile: string;
}) {
  const userId = await getCurrentUserId();
  const { name, email, mobile } = parseInput(profileSchema, input);
  await db
    .update(userT)
    .set({ name, email, mobile })
    .where(eq(userT.id, userId));
}

/* ---------------- follow-ups ---------------- */

export async function updateFollowUpsAction(input: {
  reminderIntervalDays: number;
  staleLeadDays: number;
}) {
  const userId = await getCurrentUserId();
  const { reminderIntervalDays, staleLeadDays } = parseInput(
    followUpsSchema,
    input,
  );
  await upsertSettings(userId, { reminderIntervalDays, staleLeadDays });
}

/* ---------------- default resume ---------------- */

export async function setDefaultResumeAction(id: string) {
  const userId = await getCurrentUserId();
  const resumeId = parseInput(zId, id);
  await db.transaction(async (tx) => {
    // Exactly one default per user (also enforced by a partial unique index).
    await tx
      .update(resumesT)
      .set({ isDefault: false })
      .where(eq(resumesT.userId, userId));
    await tx
      .update(resumesT)
      .set({ isDefault: true })
      .where(and(eq(resumesT.id, resumeId), eq(resumesT.userId, userId)));
    await tx
      .insert(settingsT)
      .values({ userId, defaultResumeId: resumeId })
      .onConflictDoUpdate({
        target: settingsT.userId,
        set: { defaultResumeId: resumeId },
      });
  });
}

/* ---------------- AI provider / key ---------------- */

export async function updateAiSettingsAction(input: {
  provider: AiProvider;
  model: string;
}) {
  const userId = await getCurrentUserId();
  const { provider, model } = parseInput(aiProviderSchema, input);
  await upsertSettings(userId, {
    aiProvider: provider,
    aiModel: model || null,
  });
}

export async function saveAiKeyAction(plainKey: string) {
  const userId = await getCurrentUserId();
  const key = parseInput(aiKeySchema, plainKey);
  await upsertSettings(userId, {
    aiKeyCiphertext: encryptSecret(key),
    aiKeyLast4: key.slice(-4),
  });
}

export async function removeAiKeyAction() {
  const userId = await getCurrentUserId();
  await upsertSettings(userId, { aiKeyCiphertext: null, aiKeyLast4: null });
}

/** Save custom AI instruction prompts (empty string → clear = use default). */
export async function updateAiPromptsAction(input: {
  summary: string;
  draft: string;
  score: string;
}) {
  const userId = await getCurrentUserId();
  const { summary, draft, score } = parseInput(aiPromptsSchema, input);
  await upsertSettings(userId, {
    promptSummary: summary.trim() || null,
    promptDraft: draft.trim() || null,
    promptScore: score.trim() || null,
  });
}

/* ---------------- resume text (for AI fit scoring) ---------------- */

/** Read a resume's pasted text for editing in Settings. */
export async function getResumeTextAction(id: string): Promise<string> {
  const userId = await getCurrentUserId();
  const resumeId = parseInput(zId, id);
  const [r] = await db
    .select({ text: resumesT.resumeText })
    .from(resumesT)
    .where(and(eq(resumesT.id, resumeId), eq(resumesT.userId, userId)));
  return r?.text ?? "";
}

/** Save a resume's pasted text. */
export async function updateResumeTextAction(id: string, text: string) {
  const userId = await getCurrentUserId();
  const resumeId = parseInput(zId, id);
  const clean = parseInput(resumeTextSchema, text);
  await db
    .update(resumesT)
    .set({ resumeText: clean.trim() || null })
    .where(and(eq(resumesT.id, resumeId), eq(resumesT.userId, userId)));
}

/* ---------------- sync schedule ---------------- */

export async function updateSyncIntervalAction(hours: number) {
  const userId = await getCurrentUserId();
  const h = parseInput(syncIntervalSchema, hours);
  await upsertSettings(userId, { syncIntervalHours: h });
}

/* ---------------- ingestion issues ---------------- */

export async function clearIngestErrorsAction() {
  const userId = await getCurrentUserId();
  await db.delete(errorsT).where(eq(errorsT.userId, userId));
}

/* ---------------- Gmail ingestion rules ---------------- */

export async function updateGmailConfigAction(input: {
  senders: string[];
  label: string;
  subjectKeywords: string;
  lookbackDays: number;
}) {
  const userId = await getCurrentUserId();
  const parsed = parseInput(gmailConfigSchema, input);
  const set = {
    senders: parsed.senders,
    label: parsed.label || null,
    subjectKeywords: parsed.subjectKeywords || null,
    lookbackDays: parsed.lookbackDays,
  };
  await db
    .insert(gmailConfigT)
    .values({ userId, ...set })
    .onConflictDoUpdate({ target: gmailConfigT.userId, set });
}

/* ---------------- Google (Gmail) connection ---------------- */

/** Unlink the user's Google account (removes the stored refresh token). */
export async function disconnectGoogleAction() {
  const userId = await getCurrentUserId();
  await db
    .delete(accountT)
    .where(and(eq(accountT.userId, userId), eq(accountT.providerId, "google")));
}

/* ---------------- resumes ---------------- */

/**
 * Upload a résumé: store the file bytes, extract the text (used for AI
 * scoring), and create the résumé row. Accepts .pdf and .docx only.
 */
export async function uploadResumeAction(
  formData: FormData,
): Promise<{ ok: true; resumeId: string } | { ok: false; error: string }> {
  const userId = await getCurrentUserId();
  const file = formData.get("file");
  const label = parseInput(
    z.string().trim().min(1, "Give this résumé a name.").max(120),
    formData.get("label"),
  );
  if (!(file instanceof File)) return { ok: false, error: "No file provided." };
  if (file.size > RESUME_MAX_BYTES) {
    return { ok: false, error: "File must be under 5 MB." };
  }
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (ext !== "pdf" && ext !== "docx") {
    return { ok: false, error: "Upload a PDF or Word (.docx) file." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  let text = "";
  try {
    text = await extractResumeText(bytes, ext);
  } catch {
    // Extraction can fail on scanned/oddly-encoded files — keep the file and
    // let the user paste the text manually.
    text = "";
  }

  const [row] = await db
    .insert(resumesT)
    .values({
      userId,
      label,
      fileName: file.name,
      fileType: ext,
      sizeKb: Math.max(1, Math.round(file.size / 1024)),
      blobUrl: "db", // bytes live in resume_files, not blob storage
      resumeText: text || null,
      isDefault: false,
    })
    .returning({ id: resumesT.id });

  await db.insert(resumeFilesT).values({
    resumeId: row.id,
    userId,
    contentType: file.type || "application/octet-stream",
    data: bytes,
  });

  return { ok: true, resumeId: row.id };
}

/** Fetch a stored résumé file for download (base64-encoded). */
export async function getResumeFileAction(id: string): Promise<
  { ok: true; fileName: string; contentType: string; base64: string } | {
    ok: false;
    error: string;
  }
> {
  const userId = await getCurrentUserId();
  const resumeId = parseInput(zId, id);
  const [meta] = await db
    .select({ fileName: resumesT.fileName })
    .from(resumesT)
    .where(and(eq(resumesT.id, resumeId), eq(resumesT.userId, userId)));
  if (!meta) return { ok: false, error: "Résumé not found." };
  const [f] = await db
    .select({ contentType: resumeFilesT.contentType, data: resumeFilesT.data })
    .from(resumeFilesT)
    .where(
      and(eq(resumeFilesT.resumeId, resumeId), eq(resumeFilesT.userId, userId)),
    );
  if (!f) return { ok: false, error: "No file stored for this résumé." };
  return {
    ok: true,
    fileName: meta.fileName,
    contentType: f.contentType,
    base64: f.data.toString("base64"),
  };
}

export async function renameResumeAction(id: string, label: string) {
  const userId = await getCurrentUserId();
  const resumeId = parseInput(zId, id);
  const cleanLabel = parseInput(
    z.string().trim().min(1, "Give this resume a name.").max(120),
    label,
  );
  await db
    .update(resumesT)
    .set({ label: cleanLabel })
    .where(and(eq(resumesT.id, resumeId), eq(resumesT.userId, userId)));
}

export async function deleteResumeAction(id: string) {
  const userId = await getCurrentUserId();
  const resumeId = parseInput(zId, id);
  // user_settings.default_resume_id FK is ON DELETE SET NULL, so clearing the
  // default is automatic.
  await db
    .delete(resumesT)
    .where(and(eq(resumesT.id, resumeId), eq(resumesT.userId, userId)));
}
