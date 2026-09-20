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
  user as userT,
  userSettings as settingsT,
} from "@/db/schema";
import type { AiProvider } from "@/lib/types";
import { isValidEmail, splitMobile, validateMobile } from "@/lib/validation";

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
  const name = input.name.trim();
  const email = input.email.trim();
  const mobile = input.mobile.trim();
  if (!name) throw new Error("Name is required.");
  if (!isValidEmail(email)) throw new Error("Enter a valid email address.");
  const { dial, national } = splitMobile(mobile);
  const mobileError = validateMobile(dial, national);
  if (mobileError) throw new Error(mobileError);
  await db
    .update(userT)
    .set({ name, email, mobile })
    .where(eq(userT.id, userId));
}

/* ---------------- follow-ups ---------------- */

/** Whole number of days, clamped to 1–365. */
function clampDays(n: number): number {
  const r = Math.round(n);
  if (!Number.isFinite(r) || r < 1) return 1;
  return Math.min(365, r);
}

export async function updateFollowUpsAction(input: {
  reminderIntervalDays: number;
  staleLeadDays: number;
}) {
  const userId = await getCurrentUserId();
  await upsertSettings(userId, {
    reminderIntervalDays: clampDays(input.reminderIntervalDays),
    staleLeadDays: clampDays(input.staleLeadDays),
  });
}

/* ---------------- default resume ---------------- */

export async function setDefaultResumeAction(resumeId: string) {
  const userId = await getCurrentUserId();
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
  await upsertSettings(userId, {
    aiProvider: input.provider,
    aiModel: input.model || null,
  });
}

export async function saveAiKeyAction(plainKey: string) {
  const userId = await getCurrentUserId();
  const key = plainKey.trim();
  if (key.length < 8) throw new Error("Invalid API key.");
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
}) {
  const userId = await getCurrentUserId();
  await upsertSettings(userId, {
    promptSummary: input.summary.trim() || null,
    promptDraft: input.draft.trim() || null,
  });
}

/* ---------------- sync schedule ---------------- */

const ALLOWED_INTERVALS = [1, 3, 6, 12, 24];

export async function updateSyncIntervalAction(hours: number) {
  const userId = await getCurrentUserId();
  const h = ALLOWED_INTERVALS.includes(hours) ? hours : 24;
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
  const senders = input.senders.map((s) => s.trim()).filter(Boolean);
  const badSenders = senders.filter((s) => !isValidEmail(s));
  if (badSenders.length > 0) {
    throw new Error(`Invalid sender address: ${badSenders.join(", ")}`);
  }
  const set = {
    senders,
    label: input.label || null,
    subjectKeywords: input.subjectKeywords || null,
    lookbackDays: input.lookbackDays,
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

export async function addResumeAction(input: {
  label: string;
  fileName: string;
  fileType: "pdf" | "doc" | "docx";
  sizeKb: number;
}) {
  const userId = await getCurrentUserId();
  // File bytes aren't stored yet (nothing reads them until AI drafting lands in
  // Milestone C) — store metadata with a placeholder blobUrl.
  await db.insert(resumesT).values({
    userId,
    label: input.label,
    fileName: input.fileName,
    fileType: input.fileType,
    sizeKb: input.sizeKb,
    blobUrl: `local://${input.fileName}`,
    isDefault: false,
  });
}

export async function renameResumeAction(id: string, label: string) {
  const userId = await getCurrentUserId();
  await db
    .update(resumesT)
    .set({ label })
    .where(and(eq(resumesT.id, id), eq(resumesT.userId, userId)));
}

export async function deleteResumeAction(id: string) {
  const userId = await getCurrentUserId();
  // user_settings.default_resume_id FK is ON DELETE SET NULL, so clearing the
  // default is automatic.
  await db
    .delete(resumesT)
    .where(and(eq(resumesT.id, id), eq(resumesT.userId, userId)));
}
