import "server-only";

import { and, asc, count, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiInterviewMessages, aiInterviews, interviewEvaluations, plans, user } from "@/db/schema";
import { settleInterview, type Phase } from "./engine";
import type {
  AllowanceState,
  BookingRow,
  BookingStatus,
  ChatMessage,
  Difficulty,
  InterviewSettingsSnapshot,
  InterviewStatus,
  InterviewSummary,
  MetricScores,
  MetricWeights,
  PlannedQuestion,
  ReportWriting,
} from "./model";

// What the candidate's Mock interviews screens read. Every query is scoped to
// the signed-in user (callers pass getCurrentUserId()).

type InterviewRow = typeof aiInterviews.$inferSelect;
type EvaluationRow = typeof interviewEvaluations.$inferSelect;

/* ---------------- allowance (D5) ---------------- */

/**
 * What the candidate has left before paying. A paid plan grants its allowance
 * each period (the plan's expiry marks the period; a renewal or upgrade moves
 * it, so the count starts fresh). The Free plan's allowance is once ever.
 */
export async function getAllowance(userId: string): Promise<AllowanceState> {
  const [u] = await db
    .select({ planExpiresAt: user.planExpiresAt, planName: plans.name, isFree: plans.isFree, included: plans.aiInterviewsIncluded })
    .from(user)
    .leftJoin(plans, sql`${plans.id}::text = ${user.planId}`)
    .where(eq(user.id, userId));
  if (!u || !u.included) return { kind: "none" };

  if (u.isFree) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(aiInterviews)
      .where(and(eq(aiInterviews.userId, userId), eq(aiInterviews.coverage, "free")));
    return { kind: "free", left: Math.max(0, u.included - n) };
  }

  // An expired paid plan has no allowance (limited mode).
  if (!u.planExpiresAt || u.planExpiresAt.getTime() <= Date.now()) return { kind: "none" };
  const [{ n }] = await db
    .select({ n: count() })
    .from(aiInterviews)
    .where(and(eq(aiInterviews.userId, userId), eq(aiInterviews.coverage, "plan"), eq(aiInterviews.allowancePeriodEnds, u.planExpiresAt)));
  return { kind: "plan", planName: u.planName ?? "", included: u.included, used: n, periodEnds: u.planExpiresAt.toISOString() };
}

/* ---------------- bookings ---------------- */

/** Bring the user's running interviews up to date (dropped connections, closed windows) before showing them. */
async function settleUser(userId: string): Promise<void> {
  const running = await db
    .select({ id: aiInterviews.id })
    .from(aiInterviews)
    .where(and(eq(aiInterviews.userId, userId), inArray(aiInterviews.status, ["in_progress", "interrupted"])));
  for (const r of running) await settleInterview(r.id);
}

function resumeMinutesLeft(i: InterviewRow, now: number): number {
  if (!i.interruptedAt) return i.settings.resumeWindowMinutes;
  const end = i.interruptedAt.getTime() + i.settings.resumeWindowMinutes * 60_000;
  return Math.max(0, Math.ceil((end - now) / 60_000));
}

function bookingStatus(i: InterviewRow, now: number): BookingStatus {
  switch (i.status) {
    case "ready":
      // The expiry job (R1.5) marks these; until it runs, show the truth.
      return i.validUntil.getTime() <= now ? "expired" : "ready";
    case "stopped":
      return "completed";
    case "pending_payment":
      return "ready"; // never listed (filtered out); here for completeness
    default:
      return i.status;
  }
}

function toBooking(i: InterviewRow, reportId: string | undefined, now: number): BookingRow {
  const status = bookingStatus(i, now);
  return {
    id: i.id,
    role: i.role,
    category: i.category,
    industry: i.industry,
    difficulty: i.difficulty as Difficulty,
    durationMin: i.durationMin,
    topics: i.topics,
    bookedAt: i.createdAt.toISOString(),
    validUntil: i.validUntil.toISOString(),
    payment:
      i.coverage === "paid"
        ? { kind: "paid", full: i.priceFullPaise, final: i.pricePaise, percent: i.discountPercent }
        : i.coverage === "plan"
          ? { kind: "plan", planName: i.planName ?? "" }
          : i.coverage === "credit"
            ? { kind: "credit" }
            : { kind: "free" },
    status,
    ...(status === "interrupted" ? { resumeMinutesLeft: resumeMinutesLeft(i, now) } : {}),
    ...(reportId ? { reportId } : {}),
  };
}

/** Submitted AI reports for these interviews, by interview id. */
async function reportsFor(ids: string[]): Promise<Map<string, EvaluationRow>> {
  if (!ids.length) return new Map();
  const rows = await db
    .select()
    .from(interviewEvaluations)
    .where(and(inArray(interviewEvaluations.aiInterviewId, ids), eq(interviewEvaluations.status, "submitted")));
  return new Map(rows.map((r) => [r.aiInterviewId!, r]));
}

/** Every booking but unpaid ones, newest first. */
export async function listBookings(userId: string): Promise<BookingRow[]> {
  await settleUser(userId);
  const list = await db
    .select()
    .from(aiInterviews)
    .where(and(eq(aiInterviews.userId, userId), ne(aiInterviews.status, "pending_payment")))
    .orderBy(desc(aiInterviews.createdAt));
  const reports = await reportsFor(list.map((i) => i.id));
  const now = Date.now();
  return list.map((i) => toBooking(i, reports.has(i.id) ? i.id : undefined, now));
}

async function ownInterview(userId: string, id: string): Promise<InterviewRow | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const [i] = await db
    .select()
    .from(aiInterviews)
    .where(and(eq(aiInterviews.id, id), eq(aiInterviews.userId, userId)));
  return i;
}

async function messagesOf(interviewId: string): Promise<ChatMessage[]> {
  const rows = await db
    .select()
    .from(aiInterviewMessages)
    .where(eq(aiInterviewMessages.interviewId, interviewId))
    .orderBy(asc(aiInterviewMessages.seq));
  return rows.map((m) => ({
    id: m.id,
    from: m.sender === "ai" ? "ai" : "you",
    text: m.text,
    ...(m.questionNo ? { questionNo: m.questionNo } : {}),
    at: m.clockSeconds,
    kind: m.kind as ChatMessage["kind"],
  }));
}

export interface BriefingData {
  booking: BookingRow;
  settings: InterviewSettingsSnapshot;
  /** Resuming: answers given, the question reached and the last thing asked. */
  answered: number;
  atQuestion: number;
  lastQuestion: string;
  /** Seconds on the clock so far (it counts connected time only). */
  activeSeconds: number;
}

/** The briefing before starting or resuming (D13e). Only startable bookings. */
export async function getBriefing(userId: string, id: string): Promise<BriefingData | null> {
  await settleUser(userId);
  const i = await ownInterview(userId, id);
  if (!i) return null;
  const booking = toBooking(i, undefined, Date.now());
  if (!["ready", "in_progress", "interrupted"].includes(booking.status)) return null;
  const messages = booking.status === "ready" ? [] : await messagesOf(i.id);
  return {
    booking,
    settings: i.settings,
    answered: messages.filter((m) => m.from === "you").length,
    atQuestion: messages.reduce((n, m) => Math.max(n, m.questionNo ?? 0), 0),
    lastQuestion: [...messages].reverse().find((m) => m.from === "ai")?.text ?? "",
    activeSeconds: i.activeSeconds,
  };
}

export interface BookingSetup {
  id: string;
  role: string;
  industry: string;
  category: string;
  difficulty: Difficulty;
  durationMin: number;
  topics: string[];
  leadId: string | null;
  resumeSource: "saved" | "upload" | "paste";
  resumeId: string | null;
  resumeText: string;
  jobDescriptionSource: "lead" | "paste" | "none";
  jobDescription: string;
}

/** A booking that hasn't started, for the edit form (D13c). */
export async function getBookingSetup(userId: string, id: string): Promise<BookingSetup | null> {
  const i = await ownInterview(userId, id);
  if (!i || i.status !== "ready" || i.validUntil.getTime() <= Date.now()) return null;
  return {
    id: i.id,
    role: i.role,
    industry: i.industry,
    category: i.category,
    difficulty: i.difficulty as Difficulty,
    durationMin: i.durationMin,
    topics: i.topics,
    leadId: i.leadId,
    resumeSource: i.resumeSource as BookingSetup["resumeSource"],
    resumeId: i.resumeId,
    resumeText: i.resumeSource === "saved" ? "" : i.resumeText,
    jobDescriptionSource: i.jobDescriptionSource as BookingSetup["jobDescriptionSource"],
    jobDescription: i.jobDescriptionSource === "paste" ? i.jobDescription : "",
  };
}

/* ---------------- the interview screen ---------------- */

export interface SessionData {
  id: string;
  role: string;
  category: string;
  difficulty: Difficulty;
  durationMin: number;
  settings: InterviewSettingsSnapshot;
  /** The candidate's topics and the planned question that covers each. */
  topics: { name: string; question?: number }[];
  plan: PlannedQuestion[];
  messages: ChatMessage[];
  activeSeconds: number;
  /** live, wrapup, or ended (finished, stopped or failed). */
  phase: Phase;
  status: string;
  /** Ended: whether the report exists yet. */
  reportReady: boolean;
}

/** The interview screen. A booking that hasn't started yet returns "not started" (it starts from the briefing). */
export async function getSession(userId: string, id: string): Promise<SessionData | "not_started" | null> {
  await settleUser(userId);
  const i = await ownInterview(userId, id);
  if (!i) return null;
  if (i.status === "ready" || i.status === "pending_payment" || i.status === "expired") return i.status === "ready" ? "not_started" : null;
  const phase: Phase = i.status === "in_progress" || i.status === "interrupted" ? (i.wrapUpStartedAt ? "wrapup" : "live") : "ended";
  const reportReady = phase === "ended" && (await reportsFor([i.id])).has(i.id);
  const plan = i.questionPlan ?? [];
  return {
    id: i.id,
    role: i.role,
    category: i.category,
    difficulty: i.difficulty as Difficulty,
    durationMin: i.durationMin,
    settings: i.settings,
    topics: i.topics.map((name) => ({ name, question: plan.find((q) => q.topic === name)?.no })),
    plan,
    messages: await messagesOf(i.id),
    activeSeconds: i.activeSeconds,
    phase,
    status: i.status,
    reportReady,
  };
}

/* ---------------- history, performance and reports ---------------- */

function scoresOf(e: EvaluationRow): MetricScores {
  return {
    communication: e.communication ?? 0,
    technical: e.technical ?? 0,
    confidence: e.confidence ?? 0,
    problemSolving: e.problemSolving ?? 0,
    relevance: e.relevance ?? 0,
  };
}

function historyStatus(i: InterviewRow, report: EvaluationRow | undefined): InterviewStatus {
  if (i.status === "completed" || i.status === "stopped") return report ? "completed" : "awaiting_report";
  if (i.status === "in_progress" || i.status === "interrupted" || i.status === "failed") return i.status;
  return "in_progress";
}

/** Every interview that started, newest first (AI now; human ones join in Release 2). */
export async function listInterviews(userId: string): Promise<InterviewSummary[]> {
  await settleUser(userId);
  const list = await db
    .select()
    .from(aiInterviews)
    .where(and(eq(aiInterviews.userId, userId), isNotNull(aiInterviews.startedAt)))
    .orderBy(desc(aiInterviews.startedAt));
  const reports = await reportsFor(list.map((i) => i.id));
  return list.map((i) => {
    const report = reports.get(i.id);
    return {
      id: i.id,
      source: "ai",
      role: i.role,
      category: i.category,
      industry: i.industry,
      difficulty: i.difficulty as Difficulty,
      durationMin: i.durationMin,
      date: i.startedAt!.toISOString(),
      status: historyStatus(i, report),
      ...(report ? { scores: scoresOf(report), overall: report.overall ?? 0 } : {}),
    };
  });
}

export interface ReportData {
  /** No scores yet while the report is being written (awaiting_report). */
  interview: InterviewSummary;
  writing: ReportWriting;
  weights: MetricWeights;
  overall: number;
  messages: ChatMessage[];
  /** Every interview, for "compared with your others". */
  all: InterviewSummary[];
}

const NO_WRITING: ReportWriting = { strengths: [], improvements: [], missed: [], betterAnswers: [], nextSteps: [] };

/** A finished interview's report, or its waiting page while the report is written. */
export async function getReport(userId: string, id: string): Promise<ReportData | null> {
  const all = await listInterviews(userId);
  const interview = all.find((i) => i.id === id);
  if (!interview || (interview.status !== "completed" && interview.status !== "awaiting_report")) return null;
  if (interview.status === "awaiting_report") {
    return { interview, writing: NO_WRITING, weights: {} as MetricWeights, overall: 0, messages: [], all };
  }
  const [e] = await db
    .select()
    .from(interviewEvaluations)
    .where(and(eq(interviewEvaluations.aiInterviewId, id), eq(interviewEvaluations.userId, userId), eq(interviewEvaluations.status, "submitted")));
  if (!e?.writing || !e.weights || e.overall === null) return null;
  return {
    interview,
    writing: e.writing,
    weights: e.weights,
    overall: e.overall,
    messages: await messagesOf(id),
    all,
  };
}
