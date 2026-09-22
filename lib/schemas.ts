import "server-only";

// Zod schemas for Server Action inputs (TRD §8: validate every action input
// before it touches the DB). Actions call `parseInput(schema, raw)` which throws
// a friendly Error on the first problem; the client store surfaces the message.
//
// Pure validation helpers that are also useful on the client (country list,
// email/mobile checks) stay in lib/validation.ts; this module is server-only and
// composes them into schemas.

import { z } from "zod";
import { splitMobile, validateMobile } from "@/lib/validation";
import { OUTREACH_KIND_LABELS, RESUME_ALLOWED_EXT } from "@/lib/types";

/* ---------------- shared primitives ---------------- */

export const zId = z.string().trim().min(1, "Missing id.");
export const zEmail = z.string().trim().email("Enter a valid email address.");

/** Combined mobile string ("+91 9876543210"). Optional — "" is allowed. */
export const zMobile = z.string().trim().superRefine((raw, ctx) => {
  const { dial, national } = splitMobile(raw);
  const error = validateMobile(dial, national);
  if (error) ctx.addIssue({ code: "custom", message: error });
});

/** Whole number of days, clamped to 1–365. */
export const zDayCount = z.coerce
  .number()
  .transform((n) => {
    const r = Math.round(n);
    if (!Number.isFinite(r) || r < 1) return 1;
    return Math.min(365, r);
  });

const zEnum = <T extends readonly string[]>(values: T, msg: string) =>
  z.enum(values as unknown as [string, ...string[]], { message: msg });

/* ---------------- settings ---------------- */

// Email is the unique login ID and isn't editable from the profile form.
export const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  mobile: zMobile,
});

export const followUpsSchema = z.object({
  reminderIntervalDays: zDayCount,
  staleLeadDays: zDayCount,
});

export const gmailConfigSchema = z.object({
  senders: z
    .array(z.string())
    .transform((arr) => arr.map((s) => s.trim()).filter(Boolean))
    .refine((arr) => arr.every((s) => zEmail.safeParse(s).success), {
      message: "Every sender must be a valid email address.",
    }),
  label: z.string().trim().max(200),
  subjectKeywords: z.string().trim().max(500),
  lookbackDays: z.coerce.number().int().min(0).max(3650),
});

export const aiProviderSchema = z.object({
  provider: zEnum(
    ["openai", "anthropic", "openrouter"] as const,
    "Unknown AI provider.",
  ),
  model: z.string().trim().max(120),
});

export const aiKeySchema = z.string().trim().min(8, "Enter a valid API key.");

export const aiPromptsSchema = z.object({
  summary: z.string().max(8000),
  draft: z.string().max(8000),
  score: z.string().max(8000),
});

export const resumeTextSchema = z.string().max(50000);

export const syncIntervalSchema = z.coerce
  .number()
  .refine((h) => [1, 3, 6, 12, 24].includes(h), "Unsupported sync interval.");

export const resumeMetaSchema = z.object({
  label: z.string().trim().min(1, "Give this resume a name.").max(120),
  fileName: z.string().trim().min(1).max(255),
  fileType: z.enum(RESUME_ALLOWED_EXT, { message: "Unsupported file type." }),
  sizeKb: z.coerce.number().int().min(1).max(5 * 1024),
});

/* ---------------- AI actions ---------------- */

export const jdInputSchema = z.object({
  leadId: zId,
  jdText: z.string().trim().min(1, "Paste the job description first.").max(50000),
});

export const contactTextSchema = z
  .string()
  .trim()
  .min(1, "Paste the hiring-team or referral text first.")
  .max(20000);

export const draftInputSchema = z.object({
  leadId: zId,
  contactId: zId,
  kind: zEnum(
    Object.keys(OUTREACH_KIND_LABELS),
    "Unknown outreach type.",
  ),
  resumeLabel: z.string().trim().max(200),
});

/** Test an unsaved prompt against sample input (no DB write). */
export const promptPreviewSchema = z.object({
  system: z.string().trim().min(1, "Enter a prompt to test.").max(8000),
  input: z.string().trim().min(1, "Add some sample text to test against.").max(50000),
});

/* ---------------- data / leads ---------------- */

/** Permanently delete a set of leads — 1..500 ids. */
export const deleteLeadsSchema = z
  .array(zId)
  .min(1, "Select at least one lead.")
  .max(500);

/** AI fit-scoring of a lead against a resume. */
export const scoreFitSchema = z.object({
  leadId: zId,
  resumeId: zId,
});

/* ---------------- helper ---------------- */

/** Parse `raw` with `schema`, throwing the first issue's message as an Error. */
export function parseInput<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Invalid input.");
  }
  return result.data;
}
