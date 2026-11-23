"use server";

// Candidate Mock interviews actions: book an AI interview, edit it before it
// starts, and run the interview (docs/interview-prep/spec.md D5, D10, D11,
// D13a–e). Each one checks the session and passes only the signed-in user on;
// the booking itself lives in lib/mock-interviews/booking.ts.

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/current-user";
import { aiInterviews } from "@/db/schema";
import { aiInterviewsOpen, getModuleSettings } from "@/lib/mock-interviews/config";
import { bookAiInterview, material, parseForm, type BookingResult } from "@/lib/mock-interviews/booking";
import { endInterview, heartbeat, startInterview, submitAnswer, type LiveState } from "@/lib/mock-interviews/engine";

type Result = BookingResult;

/**
 * Book an AI interview (D13a): the allowance first, otherwise a paid booking
 * that waits for its payment.
 */
export async function bookAiInterviewAction(form: FormData): Promise<Result> {
  const userId = await getCurrentUserId();
  const r = await bookAiInterview(userId, form);
  if (r.ok && !r.checkout) revalidatePath("/mock-interviews", "layout");
  return r;
}

/**
 * Edit a booking before it starts (D13c). Difficulty and length stay as booked,
 * since they set the price; everything else can change.
 */
export async function updateAiBookingAction(id: unknown, form: FormData): Promise<Result> {
  const userId = await getCurrentUserId();
  const bookingId = z.string().uuid().safeParse(id);
  if (!bookingId.success) return { ok: false, error: "That booking isn't available." };
  const settings = await getModuleSettings();
  if (!aiInterviewsOpen(settings)) return { ok: false, error: "AI interviews aren't open right now." };
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
  if (!settings.categories.includes(v.category)) return { ok: false, error: "Pick the kind of interview.", field: "category" };
  const m = await material(userId, v, parsed.file);
  if ("error" in m) return { ok: false, error: m.error, field: m.field };

  const updated = await db
    .update(aiInterviews)
    .set({ role: v.role, industry: v.industry, industryOther: v.industryOther || null, category: v.category, topics: v.topics, ...m })
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
