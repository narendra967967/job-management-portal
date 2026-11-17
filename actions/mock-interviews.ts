"use server";

// Candidate Mock interviews actions: book an AI interview and edit it before
// it starts (docs/interview-prep/spec.md D5, D10, D11, D13a–c). Scoped to the
// signed-in user and Zod-validated. Paying for an interview outside the
// allowance arrives with the interviewer itself (roadmap R1.5).

import { and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/current-user";
import { extractResumeText } from "@/lib/resume-extract";
import { aiInterviews, jobLeadDetails, jobLeads, paymentOrders, plans, resumes, user } from "@/db/schema";
import { aiInterviewsOpen, getModuleSettings, settingsSnapshot } from "@/lib/mock-interviews/config";
import { DIFFICULTIES, INDUSTRIES, aiInterviewQuote } from "@/lib/mock-interviews/model";
import { aiPaymentAvailable, sendAiInterviewReceipt, startAiInterviewCheckout, type AiCheckoutStart } from "@/lib/payments/ai-interview-orders";
import { endInterview, heartbeat, startInterview, submitAnswer, type LiveState } from "@/lib/mock-interviews/engine";

type Result = { ok: true; id: string; checkout?: AiCheckoutStart } | { ok: false; error: string; field?: string };

const LIMITS = { role: 100, paste: 20_000, minJd: 100, minResume: 300, topics: 10, topic: 40, fileBytes: 5 * 1024 * 1024 };

const setupSchema = z.object({
  role: z.string().trim().min(1, "Enter the role you're interviewing for.").max(LIMITS.role, `Keep the role under ${LIMITS.role} characters.`),
  industry: z.enum(INDUSTRIES, { message: "Pick an industry." }),
  category: z.string().trim().min(1, "Pick the kind of interview.").max(40),
  difficulty: z.enum(DIFFICULTIES),
  durationMin: z.number().int(),
  topics: z
    .array(z.string().trim().min(1).max(LIMITS.topic, `Keep each topic under ${LIMITS.topic} characters.`))
    .min(1, "Add at least one topic you want covered.")
    .max(LIMITS.topics, `Pick up to ${LIMITS.topics} topics.`),
  leadId: z.string().uuid().nullable(),
  resumeMode: z.enum(["saved", "upload", "paste"]),
  resumeId: z.string().uuid().nullable(),
  resumeText: z.string().max(LIMITS.paste, "The resume is too long to paste. Upload the file instead.").optional().default(""),
  jdMode: z.enum(["lead", "paste", "general"]),
  jdLeadId: z.string().uuid().nullable(),
  jdText: z.string().max(LIMITS.paste, "The job description is too long.").optional().default(""),
});
type Setup = z.infer<typeof setupSchema>;

type Material = {
  leadId: string | null;
  leadLabel: string | null;
  resumeId: string | null;
  resumeSource: "saved" | "upload" | "paste";
  resumeLabel: string;
  resumeText: string;
  jobDescriptionSource: "lead" | "paste" | "none";
  jobDescription: string;
};

/**
 * Resolve the resume and job description the AI will read, checking that a
 * saved resume or lead belongs to the user. Returns a field error otherwise.
 */
async function material(userId: string, v: Setup, file: File | null): Promise<Material | { error: string; field: string }> {
  // Lead the interview is for (optional), with a label that outlives the lead.
  let leadLabel: string | null = null;
  const leadId = v.leadId ?? (v.jdMode === "lead" ? v.jdLeadId : null);
  if (leadId) {
    const [l] = await db
      .select({ title: jobLeads.title, company: jobLeads.company })
      .from(jobLeads)
      .where(and(eq(jobLeads.id, leadId), eq(jobLeads.userId, userId)));
    if (!l) return { error: "That lead isn't available.", field: "jd" };
    leadLabel = `${l.title} at ${l.company}`;
  }

  let resumeText = "";
  let resumeLabel = "";
  if (v.resumeMode === "saved") {
    if (!v.resumeId) return { error: "Pick a saved resume, or upload or paste one.", field: "resume" };
    const [r] = await db
      .select({ label: resumes.label, text: resumes.resumeText })
      .from(resumes)
      .where(and(eq(resumes.id, v.resumeId), eq(resumes.userId, userId)));
    if (!r) return { error: "That resume isn't available.", field: "resume" };
    if (!r.text?.trim()) return { error: "We couldn't read text from that resume. Upload it again, or paste it.", field: "resume" };
    resumeText = r.text;
    resumeLabel = r.label;
  } else if (v.resumeMode === "upload") {
    if (!file) return { error: "Choose a PDF or Word file.", field: "resume" };
    if (file.size > LIMITS.fileBytes) return { error: "The file is over 5 MB.", field: "resume" };
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (ext !== "pdf" && ext !== "docx") return { error: "Upload a PDF or Word (.docx) file.", field: "resume" };
    try {
      resumeText = await extractResumeText(Buffer.from(await file.arrayBuffer()), ext);
    } catch {
      resumeText = "";
    }
    if (resumeText.trim().length < LIMITS.minResume) return { error: "We couldn't read enough text from that file. Paste your resume instead.", field: "resume" };
    resumeText = resumeText.slice(0, LIMITS.paste);
    resumeLabel = file.name.slice(0, 120);
  } else {
    resumeText = v.resumeText.trim();
    if (resumeText.length < LIMITS.minResume) return { error: `Paste your full resume (at least ${LIMITS.minResume} characters).`, field: "resume" };
    resumeLabel = "Pasted resume";
  }

  let jobDescription = "";
  if (v.jdMode === "lead") {
    if (!v.jdLeadId) return { error: "Pick a lead.", field: "jd" };
    const [d] = await db
      .select({ jd: jobLeadDetails.jdText })
      .from(jobLeadDetails)
      .where(and(eq(jobLeadDetails.leadId, v.jdLeadId), eq(jobLeadDetails.userId, userId)));
    jobDescription = d?.jd?.trim() ?? "";
    if (!jobDescription) return { error: "This lead has no job description saved. Paste one instead, or open the lead and add it.", field: "jd" };
  } else if (v.jdMode === "paste") {
    // Markdown from the editor; the AI reads it as written.
    jobDescription = v.jdText.trim();
    if (jobDescription.length < LIMITS.minJd) return { error: `Paste the job description (at least ${LIMITS.minJd} characters), or choose General preparation.`, field: "jd" };
  }

  return {
    leadId,
    leadLabel,
    resumeId: v.resumeMode === "saved" ? v.resumeId : null,
    resumeSource: v.resumeMode,
    resumeLabel,
    resumeText,
    jobDescriptionSource: v.jdMode === "general" ? "none" : v.jdMode,
    jobDescription: jobDescription.slice(0, LIMITS.paste),
  };
}

function parseForm(form: FormData): { setup: Setup; file: File | null } | { error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("setup") ?? ""));
  } catch {
    return { error: "Something went wrong. Reload the page and try again." };
  }
  const p = setupSchema.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the form and try again." };
  const f = form.get("file");
  return { setup: p.data, file: f instanceof File && f.size > 0 ? f : null };
}

/**
 * Book an AI interview (D13a). It spends the allowance: the Free plan's one, or
 * one of the plan's for this period. The user's row is locked while counting,
 * so two quick bookings can't both take the last one.
 */
export async function bookAiInterviewAction(form: FormData): Promise<Result> {
  const userId = await getCurrentUserId();
  const settings = await getModuleSettings();
  if (!aiInterviewsOpen(settings)) return { ok: false, error: "AI interviews aren't open yet." };
  const parsed = parseForm(form);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const v = parsed.setup;
  if (!settings.categories.includes(v.category)) return { ok: false, error: "Pick the kind of interview.", field: "category" };
  if (!settings.durations.includes(v.durationMin)) return { ok: false, error: "Pick one of the lengths offered." };
  const m = await material(userId, v, parsed.file);
  if ("error" in m) return { ok: false, error: m.error, field: m.field };

  const booked = await db.transaction(async (tx) => {
    const [u] = await tx
      .select({ planExpiresAt: user.planExpiresAt, planName: plans.name, isFree: plans.isFree, included: plans.aiInterviewsIncluded })
      .from(user)
      .leftJoin(plans, sql`${plans.id}::text = ${user.planId}`)
      .where(eq(user.id, userId))
      .for("update", { of: user });
    if (!u) return { ok: false, error: "Your session ended. Sign in again." } as Result;

    let coverage: "plan" | "free" | null = null;
    let allowancePeriodEnds: Date | null = null;
    if (u.included) {
      if (u.isFree) {
        const [{ n }] = await tx
          .select({ n: count() })
          .from(aiInterviews)
          .where(and(eq(aiInterviews.userId, userId), eq(aiInterviews.coverage, "free")));
        if (n < u.included) coverage = "free";
      } else if (u.planExpiresAt && u.planExpiresAt.getTime() > Date.now()) {
        const [{ n }] = await tx
          .select({ n: count() })
          .from(aiInterviews)
          .where(and(eq(aiInterviews.userId, userId), eq(aiInterviews.coverage, "plan"), eq(aiInterviews.allowancePeriodEnds, u.planExpiresAt)));
        if (n < u.included) {
          coverage = "plan";
          allowancePeriodEnds = u.planExpiresAt;
        }
      }
    }
    // Outside the allowance: priced per minute at the level's rate, less its
    // discount (D5). The booking waits as pending_payment until it's paid.
    const quote = coverage ? null : aiInterviewQuote(v.durationMin, settings.pricing[v.difficulty]);
    if (quote && !(await aiPaymentAvailable())) return { ok: false, error: "Online payment isn't available right now. Please try again later." } as Result;

    const [row] = await tx
      .insert(aiInterviews)
      .values({
        userId,
        status: quote ? "pending_payment" : "ready",
        role: v.role,
        industry: v.industry,
        category: v.category,
        difficulty: v.difficulty,
        durationMin: v.durationMin,
        topics: v.topics,
        ...m,
        coverage: coverage ?? "paid",
        planName: coverage === "plan" ? u.planName : null,
        ...(quote ? { priceFullPaise: quote.full, pricePaise: quote.final, discountPercent: quote.percent } : {}),
        allowancePeriodEnds,
        validUntil: new Date(Date.now() + settings.bookingValidDays * 86_400_000),
        settings: settingsSnapshot(settings, v.difficulty),
      })
      .returning({ id: aiInterviews.id });
    return { ok: true, id: row.id, pay: !!quote } as const;
  });
  if (!booked.ok) return booked;
  if ("pay" in booked && booked.pay) {
    const start = await startAiInterviewCheckout(userId, booked.id);
    if (!start.ok) {
      await db.delete(aiInterviews).where(and(eq(aiInterviews.id, booked.id), eq(aiInterviews.status, "pending_payment")));
      return { ok: false, error: start.error };
    }
    return { ok: true, id: booked.id, checkout: start.checkout };
  }
  revalidatePath("/mock-interviews", "layout");
  return { ok: true, id: booked.id };
}

/**
 * Edit a booking before it starts (D13c). Difficulty and length stay as booked,
 * since they set the price; everything else can change.
 */
export async function updateAiBookingAction(id: unknown, form: FormData): Promise<Result> {
  const userId = await getCurrentUserId();
  const bookingId = z.string().uuid().safeParse(id);
  if (!bookingId.success) return { ok: false, error: "That booking isn't available." };
  const parsed = parseForm(form);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const v = parsed.setup;

  const [cur] = await db
    .select({ status: aiInterviews.status, validUntil: aiInterviews.validUntil, difficulty: aiInterviews.difficulty, durationMin: aiInterviews.durationMin })
    .from(aiInterviews)
    .where(and(eq(aiInterviews.id, bookingId.data), eq(aiInterviews.userId, userId)));
  if (!cur || cur.status !== "ready" || cur.validUntil.getTime() <= Date.now())
    return { ok: false, error: "This booking can't be changed any more." };
  if (v.difficulty !== cur.difficulty || v.durationMin !== cur.durationMin)
    return { ok: false, error: "Difficulty and length stay as booked." };
  const settings = await getModuleSettings();
  if (!settings.categories.includes(v.category)) return { ok: false, error: "Pick the kind of interview.", field: "category" };
  const m = await material(userId, v, parsed.file);
  if ("error" in m) return { ok: false, error: m.error, field: m.field };

  const updated = await db
    .update(aiInterviews)
    .set({ role: v.role, industry: v.industry, category: v.category, topics: v.topics, ...m })
    .where(and(eq(aiInterviews.id, bookingId.data), eq(aiInterviews.userId, userId), eq(aiInterviews.status, "ready")))
    .returning({ id: aiInterviews.id });
  if (!updated.length) return { ok: false, error: "This booking can't be changed any more." };
  revalidatePath("/mock-interviews", "layout");
  return { ok: true, id: bookingId.data };
}

/** Whether candidates can use AI interviews now (for client screens that link to them). */
export async function aiInterviewsOpenAction(): Promise<boolean> {
  await getCurrentUserId();
  return aiInterviewsOpen(await getModuleSettings());
}

/* ---------------- the interview screen ---------------- */

const interviewId = z.string().uuid();
const MAX_ANSWER = 4000;

async function interviewGate(id: unknown): Promise<{ userId: string; id: string } | { error: string }> {
  const userId = await getCurrentUserId();
  const p = interviewId.safeParse(id);
  if (!p.success) return { error: "That interview isn't available." };
  if (!(await aiInterviewsOpenAction())) return { error: "AI interviews aren't open right now." };
  return { userId, id: p.data };
}

/** Start a ready booking (the AI writes the question plan), or resume one (D13a, D13e). */
export async function startInterviewAction(id: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const g = await interviewGate(id);
  if ("error" in g) return { ok: false, error: g.error };
  const r = await startInterview(g.userId, g.id);
  revalidatePath("/mock-interviews", "layout");
  return r;
}

/** Every 15 seconds while the interview screen is open and online: counts the clock. */
export async function interviewHeartbeatAction(id: unknown): Promise<LiveState | null> {
  const g = await interviewGate(id);
  if ("error" in g) return null;
  return heartbeat(g.userId, g.id);
}

/** Send an answer; returns it and the interviewer's reply. */
export async function answerInterviewAction(id: unknown, text: unknown) {
  const g = await interviewGate(id);
  if ("error" in g) return { ok: false as const, error: g.error };
  const t = z
    .string()
    .trim()
    .min(1, "Write or say your answer first.")
    .max(MAX_ANSWER, `Keep your answer under ${MAX_ANSWER.toLocaleString("en-US")} characters.`)
    .safeParse(text);
  if (!t.success) return { ok: false as const, error: t.error.issues[0]?.message ?? "Check your answer." };
  return submitAnswer(g.userId, g.id, t.data);
}

/** End the interview early; the answers so far are scored. */
export async function endInterviewAction(id: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const g = await interviewGate(id);
  if ("error" in g) return { ok: false, error: g.error };
  const r = await endInterview(g.userId, g.id);
  revalidatePath("/mock-interviews", "layout");
  return r;
}

/** Email the receipt for a paid interview again (bookings list → Receipt). */
export async function emailAiInterviewReceiptAction(id: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await getCurrentUserId();
  const p = interviewId.safeParse(id);
  if (!p.success) return { ok: false, error: "That booking isn't available." };
  const [o] = await db
    .select({ id: paymentOrders.id })
    .from(paymentOrders)
    .where(and(eq(paymentOrders.aiInterviewId, p.data), eq(paymentOrders.userId, userId), eq(paymentOrders.status, "paid")));
  if (!o) return { ok: false, error: "There's no payment for this booking." };
  try {
    await sendAiInterviewReceipt(o.id);
    return { ok: true };
  } catch {
    return { ok: false, error: "We couldn't send the email just now. Try again in a minute." };
  }
}
