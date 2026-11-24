"use server";

// Admin → Mock interviews: Module settings and AI interview credits
// (docs/interview-prep/spec.md §4, D13, D55). Admin-guarded and Zod-validated.
// The module AI key is encrypted at rest; only its last 4 characters are read back.

import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/current-user";
import { encryptSecret } from "@/lib/crypto";
import { testModuleAi } from "@/lib/ai";
import { aiInterviewEvents, aiInterviews, mockInterviewConfig } from "@/db/schema";
import { getModuleSettings, settingsSnapshot } from "@/lib/mock-interviews/config";
import { DEFAULT_PROMPTS, DIFFICULTIES, METRICS, type ModuleSettings } from "@/lib/mock-interviews/model";
import type { SessionEvent } from "@/lib/mock-interviews/admin-model";
import { KIND_ICON_KEYS } from "@/components/mock-interviews/category-icons";

type Result = { ok: true } | { ok: false; error: string };

function fail(e: z.ZodError): Result {
  return { ok: false, error: e.issues[0]?.message ?? "Invalid input." };
}

const part = z.enum(["open", "coming_soon"]);
const whole = (lo: number, hi: number, what: string) =>
  z.number({ message: `${what}: enter a number.` }).int(`${what}: whole numbers only.`).min(lo, `${what}: at least ${lo}.`).max(hi, `${what}: at most ${hi}.`);

const levelPricing = z
  .object({
    ratePerMinutePaise: whole(100, 100_000, "Rate per minute"),
    discountOn: z.boolean(),
    discountPercent: z.number().int().min(0).max(90),
  })
  .refine((p) => !p.discountOn || p.discountPercent >= 1, { message: "A discount that's on needs 1% to 90%." });

const sectionSchema = z.discriminatedUnion("section", [
  z.object({
    section: z.literal("availability"),
    aiState: part,
    humanState: part,
    applicationsOpen: z.boolean(),
    pauseBookings: z.boolean(),
  }),
  z.object({
    section: z.literal("ai"),
    provider: z.enum(["openai", "anthropic", "openrouter"]),
    model: z.string().trim().max(120, "Model name is too long."),
    // Blank keeps the saved key.
    key: z.string().trim().max(400).optional().default(""),
    inputCostPerMTokPaise: whole(0, 10_000_000, "Input token price"),
    cachedInputCostPerMTokPaise: whole(0, 10_000_000, "Cached input token price"),
    outputCostPerMTokPaise: whole(0, 10_000_000, "Output token price"),
  }),
  z.object({
    section: z.literal("rules"),
    categories: z
      .array(z.string().trim().min(1).max(40, "Kinds of interview: 40 characters at most."))
      .min(1, "Keep at least one kind of interview.")
      .max(40),
    // Icon per kind; only keys from the picker are accepted.
    categoryIcons: z.record(z.string().max(40), z.enum(KIND_ICON_KEYS)).optional().default({}),
    durations: z.array(z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)])).min(1, "Allow at least one length."),
    minutesPerQuestion: z.number().min(1, "Minutes per question: at least 1.").max(5, "Minutes per question: at most 5.").multipleOf(0.5, "Minutes per question: steps of 0.5."),
    wrapUpMinutes: whole(0, 20, "Wrap-up extension"),
    resumeWindowMinutes: whole(5, 60, "Time away allowed"),
    paceGraceMinutes: whole(0, 15, "Pace grace period"),
  }),
  z.object({
    section: z.literal("pricing"),
    pricing: z.object({ Easy: levelPricing, Medium: levelPricing, Hard: levelPricing }),
  }),
  z
    .object({
      section: z.literal("bookings"),
      bookingValidDays: whole(1, 365, "Valid for"),
      expiryReminderDays: whole(0, 30, "Expiry reminder"),
    })
    .refine((v) => v.expiryReminderDays < v.bookingValidDays, { message: "The reminder must come before the booking expires." }),
  z
    .object({
      section: z.literal("scoring"),
      weights: z.object(Object.fromEntries(METRICS.map((m) => [m.key, whole(0, 100, m.label)])) as Record<(typeof METRICS)[number]["key"], z.ZodNumber>),
    })
    .refine((v) => Object.values(v.weights).reduce((a, b) => a + b, 0) === 100, { message: "The weights must add up to 100%." }),
  z.object({
    section: z.literal("prompts"),
    questionPlan: z.string().trim().min(20, "Each prompt needs at least 20 characters.").max(4000),
    interviewer: z.string().trim().min(20, "Each prompt needs at least 20 characters.").max(4000),
    evaluation: z.string().trim().min(20, "Each prompt needs at least 20 characters.").max(4000),
  }),
]);

/** Save one section of Module settings. The other sections stay as they are. */
export async function saveModuleSettingsAction(input: unknown): Promise<Result & { keyLast4?: string | null }> {
  const adminId = await requireAdmin();
  const p = sectionSchema.safeParse(input);
  if (!p.success) return fail(p.error);
  const v = p.data;
  const cur = await getModuleSettings();
  const next: ModuleSettings = { ...cur };
  let keyPatch: { aiKeyCiphertext: string; aiKeyLast4: string } | null = null;

  switch (v.section) {
    case "availability":
      Object.assign(next, { aiState: v.aiState, humanState: v.humanState, applicationsOpen: v.applicationsOpen, pauseBookings: v.pauseBookings });
      break;
    case "ai":
      if (v.key && v.key.length < 20) return { ok: false, error: "That doesn't look like a full API key." };
      next.provider = v.provider;
      next.model = v.model;
      next.inputCostPerMTokPaise = v.inputCostPerMTokPaise;
      next.cachedInputCostPerMTokPaise = v.cachedInputCostPerMTokPaise;
      next.outputCostPerMTokPaise = v.outputCostPerMTokPaise;
      if (v.key) keyPatch = { aiKeyCiphertext: encryptSecret(v.key), aiKeyLast4: v.key.slice(-4) };
      break;
    case "rules": {
      const seen = new Set<string>();
      const categories = v.categories.filter((c) => !seen.has(c.toLowerCase()) && seen.add(c.toLowerCase()));
      // Keep icons only for kinds still in the list.
      const categoryIcons = Object.fromEntries(categories.flatMap((c) => (v.categoryIcons[c] ? [[c, v.categoryIcons[c]]] : [])));
      Object.assign(next, {
        categories,
        categoryIcons,
        durations: [...new Set(v.durations)].sort((a, b) => a - b),
        minutesPerQuestion: v.minutesPerQuestion,
        wrapUpMinutes: v.wrapUpMinutes,
        resumeWindowMinutes: v.resumeWindowMinutes,
        paceGraceMinutes: v.paceGraceMinutes,
      });
      break;
    }
    case "pricing":
      // A discount that's off keeps no percentage, so turning it on starts clean.
      next.pricing = Object.fromEntries(
        DIFFICULTIES.map((d) => [d, { ...v.pricing[d], discountPercent: v.pricing[d].discountOn ? v.pricing[d].discountPercent : 0 }]),
      ) as ModuleSettings["pricing"];
      break;
    case "bookings":
      Object.assign(next, { bookingValidDays: v.bookingValidDays, expiryReminderDays: v.expiryReminderDays });
      break;
    case "scoring":
      next.weights = v.weights;
      break;
    case "prompts":
      next.prompts = { questionPlan: v.questionPlan, interviewer: v.interviewer, evaluation: v.evaluation };
      break;
  }

  const row = {
    aiState: next.aiState,
    humanState: next.humanState,
    applicationsOpen: next.applicationsOpen,
    pauseBookings: next.pauseBookings,
    aiProvider: next.provider,
    aiModel: next.model || null,
    aiInputCostPerMTokPaise: next.inputCostPerMTokPaise,
    aiCachedInputCostPerMTokPaise: next.cachedInputCostPerMTokPaise,
    aiOutputCostPerMTokPaise: next.outputCostPerMTokPaise,
    categories: next.categories,
    categoryIcons: next.categoryIcons,
    durations: next.durations,
    minutesPerQuestion: next.minutesPerQuestion,
    wrapUpMinutes: next.wrapUpMinutes,
    resumeWindowMinutes: next.resumeWindowMinutes,
    paceGraceMinutes: next.paceGraceMinutes,
    bookingValidDays: next.bookingValidDays,
    expiryReminderDays: next.expiryReminderDays,
    pricing: next.pricing,
    weights: next.weights,
    // The built-in default is stored as null, so later improvements to it apply.
    promptQuestionPlan: next.prompts.questionPlan === DEFAULT_PROMPTS.questionPlan ? null : next.prompts.questionPlan,
    promptInterviewer: next.prompts.interviewer === DEFAULT_PROMPTS.interviewer ? null : next.prompts.interviewer,
    promptEvaluation: next.prompts.evaluation === DEFAULT_PROMPTS.evaluation ? null : next.prompts.evaluation,
    updatedBy: adminId,
    ...(keyPatch ?? {}),
  };
  await db.insert(mockInterviewConfig).values({ id: "app", ...row }).onConflictDoUpdate({ target: mockInterviewConfig.id, set: row });
  revalidatePath("/jmp-admin/mock-interviews/settings");
  revalidatePath("/mock-interviews", "layout");
  return { ok: true, keyLast4: keyPatch ? keyPatch.aiKeyLast4 : cur.keyLast4 };
}

/** Module settings → Test connection: a tiny request with the saved key. */
export async function testModuleAiAction(): Promise<{ ok: true; model: string } | { ok: false; error: string }> {
  await requireAdmin();
  const r = await testModuleAi();
  await db
    .update(mockInterviewConfig)
    .set({ aiLastTestOk: r.ok, aiLastTestAt: new Date() })
    .where(eq(mockInterviewConfig.id, "app"));
  return r;
}

/* ---------------- AI interview sessions ---------------- */

/** The event log of one interview (admin reads it before giving one back). */
export async function getAiInterviewEventsAction(id: unknown): Promise<{ ok: true; events: SessionEvent[] } | { ok: false; error: string }> {
  await requireAdmin();
  const p = z.string().uuid().safeParse(id);
  if (!p.success) return { ok: false, error: "Unknown interview." };
  const rows = await db
    .select({ kind: aiInterviewEvents.kind, detail: aiInterviewEvents.detail, clockSeconds: aiInterviewEvents.clockSeconds })
    .from(aiInterviewEvents)
    .where(eq(aiInterviewEvents.interviewId, p.data))
    .orderBy(asc(aiInterviewEvents.createdAt))
    .limit(500);
  return { ok: true, events: rows.map((r) => ({ kind: r.kind, text: r.detail, clockSeconds: r.clockSeconds })) };
}

/**
 * Give an interview back (D13, D55): a new booking of the same setup at no
 * charge, for an interview that stopped early or failed. No money moves. The
 * reason is kept on the new booking, and each interview can be given back once
 * (a unique index makes a double click harmless).
 */
export async function creditAiInterviewAction(input: unknown): Promise<Result> {
  const adminId = await requireAdmin();
  const p = z
    .object({
      id: z.string().uuid("Unknown interview."),
      note: z.string().trim().min(10, "Write at least 10 characters on why.").max(500, "Keep the reason under 500 characters."),
    })
    .safeParse(input);
  if (!p.success) return fail(p.error);
  const settings = await getModuleSettings();

  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(aiInterviews).where(eq(aiInterviews.id, p.data.id)).for("update");
    if (!o) return { ok: false, error: "That interview no longer exists." } as Result;
    if (o.status !== "stopped" && o.status !== "failed") return { ok: false, error: "Only an interview that stopped early or failed can be given back." } as Result;
    const [dup] = await tx.select({ id: aiInterviews.id }).from(aiInterviews).where(and(eq(aiInterviews.creditedFromId, o.id)));
    if (dup) return { ok: false, error: "This interview was already given back." } as Result;

    const difficulty = (["Easy", "Medium", "Hard"] as const).find((d) => d === o.difficulty) ?? "Medium";
    await tx.insert(aiInterviews).values({
      userId: o.userId,
      status: "ready",
      role: o.role,
      industry: o.industry,
      industryOther: o.industryOther,
      category: o.category,
      difficulty: o.difficulty,
      durationMin: o.durationMin,
      topics: o.topics,
      leadId: o.leadId,
      leadLabel: o.leadLabel,
      resumeId: o.resumeId,
      resumeSource: o.resumeSource,
      resumeLabel: o.resumeLabel,
      resumeText: o.resumeText,
      jobDescriptionSource: o.jobDescriptionSource,
      jobDescription: o.jobDescription,
      coverage: "credit",
      creditedFromId: o.id,
      creditedBy: adminId,
      creditNote: p.data.note,
      validUntil: sql`now() + make_interval(days => ${settings.bookingValidDays})`,
      settings: settingsSnapshot(settings, difficulty),
    });
    return { ok: true } as Result;
  });
}
