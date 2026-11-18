import "server-only";

import { and, asc, count, eq, isNull, lt, sql } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/lib/db";
import { aiInterviewEvents, aiInterviewMessages, aiInterviews, interviewEvaluations, user } from "@/db/schema";
import { moduleAiChat, MODULE_AI_NOT_CONFIGURED, type ChatTurn, type ModuleAiResult } from "@/lib/ai";
import { sendTemplateEmail } from "@/lib/email-templates";
import { greetingName } from "@/lib/email-templates-model";
import { absoluteUrl } from "@/lib/site-url";
import { careerBriefFor } from "@/lib/career-data";
import { getModuleSettings } from "./config";
import { overallScore, plannedQuestions, type PlannedQuestion } from "./model";
import {
  evaluationFormat,
  evaluationSchema,
  fillPrompt,
  materialBlock,
  parseJsonObject,
  planFormat,
  planSchema,
  toWriting,
  turnNote,
  turnRules,
  turnSchema,
  type PromptValues,
} from "./prompts";

// The AI interviewer (spec D10, D13, D49). Everything that decides time, order
// and money happens here on the server; the browser only shows it.
//
// The clock counts connected time only (D13e): the interview screen sends a
// heartbeat every 15 seconds, and each one adds the time since the last, up to
// BEAT_CAP_SEC. No heartbeat for DISCONNECT_SEC means the candidate dropped: the
// clock stops there, and they have the resume window to come back.

const BEAT_CAP_SEC = 25;
export const DISCONNECT_SEC = 45;
const MAX_FOLLOW_UPS = 2;
/** Report attempts before the cron job gives up on an interview. */
const MAX_EVALUATION_TRIES = 6;

type Row = typeof aiInterviews.$inferSelect;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Exec = Tx | typeof db;

export type Phase = "live" | "wrapup" | "ended";
export interface LiveState {
  status: Row["status"];
  phase: Phase;
  activeSeconds: number;
}
export interface NewMessage {
  id: string;
  from: "ai" | "you";
  text: string;
  questionNo?: number;
  at: number;
  kind: "question" | "follow_up" | "answer" | "closing";
}

/* ---------------- small helpers ---------------- */

/**
 * Run slow work (writing the report) after the response is sent, so a heartbeat
 * or an answer never waits on it. Outside a request (scripts), it just runs.
 */
function later(work: () => Promise<unknown>) {
  const run = () => work().catch((err) => console.error("[mock-interviews]", err instanceof Error ? err.message : err));
  try {
    after(run);
  } catch {
    void run();
  }
}

function phaseOf(i: Pick<Row, "status" | "wrapUpStartedAt">): Phase {
  if (i.status !== "in_progress" && i.status !== "interrupted") return "ended";
  return i.wrapUpStartedAt ? "wrapup" : "live";
}

function stateOf(i: Row): LiveState {
  return { status: i.status, phase: phaseOf(i), activeSeconds: i.activeSeconds };
}

async function logEvent(x: Exec, interviewId: string, kind: string, detail: string, clockSeconds: number) {
  await x.insert(aiInterviewEvents).values({ interviewId, kind, detail: detail.slice(0, 500), clockSeconds });
}

async function lockOwn(tx: Tx, userId: string, id: string): Promise<Row | undefined> {
  const [i] = await tx
    .select()
    .from(aiInterviews)
    .where(and(eq(aiInterviews.id, id), eq(aiInterviews.userId, userId)))
    .for("update");
  return i;
}

async function nextSeq(x: Exec, interviewId: string): Promise<number> {
  const [r] = await x
    .select({ n: sql<number>`coalesce(max(${aiInterviewMessages.seq}), 0)::int` })
    .from(aiInterviewMessages)
    .where(eq(aiInterviewMessages.interviewId, interviewId));
  return (r?.n ?? 0) + 1;
}

async function answersOf(x: Exec, interviewId: string): Promise<number> {
  const [r] = await x
    .select({ n: count() })
    .from(aiInterviewMessages)
    .where(and(eq(aiInterviewMessages.interviewId, interviewId), eq(aiInterviewMessages.sender, "candidate")));
  return r?.n ?? 0;
}

/** Add an AI call's tokens and cost (admin's token prices) to the interview. */
async function addUsage(x: Exec, interviewId: string, r: Pick<ModuleAiResult, "tokensIn" | "tokensCached" | "tokensOut" | "provider" | "model">) {
  const s = await getModuleSettings();
  // Cached input is charged at its own (lower) price; 0 means the input price.
  const cachedPrice = s.cachedInputCostPerMTokPaise || s.inputCostPerMTokPaise;
  const fresh = Math.max(0, r.tokensIn - r.tokensCached);
  const cost = (fresh * s.inputCostPerMTokPaise + r.tokensCached * cachedPrice + r.tokensOut * s.outputCostPerMTokPaise) / 1_000_000;
  await x
    .update(aiInterviews)
    .set({
      tokensIn: sql`${aiInterviews.tokensIn} + ${r.tokensIn}`,
      tokensOut: sql`${aiInterviews.tokensOut} + ${r.tokensOut}`,
      aiCostPaise: sql`${aiInterviews.aiCostPaise} + ${cost}`,
      aiProvider: r.provider,
      aiModel: r.model,
    })
    .where(eq(aiInterviews.id, interviewId));
}

function promptValues(i: Row, plan: PlannedQuestion[] | null): PromptValues {
  return {
    role: i.role,
    industry: i.industry,
    category: i.category,
    difficulty: i.difficulty,
    question_count: plan?.length || plannedQuestions(i.durationMin, i.settings.minutesPerQuestion),
    topics: i.topics.join(", "),
    resume: i.resumeText,
    job_description: i.jobDescription,
    career_profile: "",
  };
}

/** Prompt values plus the candidate's career profile (for the plan and the report). */
async function promptValuesWithProfile(i: Row, plan: PlannedQuestion[] | null): Promise<PromptValues> {
  return { ...promptValues(i, plan), career_profile: await careerBriefFor(i.userId) };
}

const aiErrorText = (err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  return msg === MODULE_AI_NOT_CONFIGURED ? "The module has no AI key" : msg.replace(/sk-[A-Za-z0-9_-]+/g, "sk-…").slice(0, 200);
};

/* ---------------- disconnects and closing ---------------- */

/**
 * Bring one interview up to date: a dropped connection becomes "interrupted"
 * (the clock stopped at the last heartbeat), and an interruption past the
 * resume window closes the interview with the answers so far (D13).
 */
export async function settleInterview(id: string): Promise<void> {
  let evaluateAfter = false;
  await db.transaction(async (tx) => {
    const [i] = await tx.select().from(aiInterviews).where(eq(aiInterviews.id, id)).for("update");
    if (!i) return;
    const now = Date.now();
    if (i.status === "in_progress" && i.lastActiveAt && now - i.lastActiveAt.getTime() > DISCONNECT_SEC * 1000) {
      await tx.update(aiInterviews).set({ status: "interrupted", interruptedAt: i.lastActiveAt }).where(eq(aiInterviews.id, id));
      await logEvent(tx, id, "disconnect", "Connection lost; clock paused", i.activeSeconds);
      i.status = "interrupted";
      i.interruptedAt = i.lastActiveAt;
    }
    if (i.status === "interrupted" && i.interruptedAt) {
      const deadline = i.interruptedAt.getTime() + i.settings.resumeWindowMinutes * 60_000;
      if (now > deadline) {
        const answers = await answersOf(tx, id);
        await tx
          .update(aiInterviews)
          .set({ status: answers > 0 ? "stopped" : "failed", endedAt: new Date(deadline), endReason: answers > 0 ? "not_resumed" : "abandoned" })
          .where(eq(aiInterviews.id, id));
        await logEvent(
          tx,
          id,
          "end",
          answers > 0
            ? `Not resumed within ${i.settings.resumeWindowMinutes} minutes; closed with the answers so far`
            : `Not resumed within ${i.settings.resumeWindowMinutes} minutes, with no answers`,
          i.activeSeconds,
        );
        evaluateAfter = answers > 0;
      }
    }
  });
  if (evaluateAfter) later(() => evaluateInterview(id));
}

/* ---------------- start, resume ---------------- */

async function writePlan(i: Row): Promise<PlannedQuestion[]> {
  const s = await getModuleSettings();
  const count = plannedQuestions(i.durationMin, i.settings.minutesPerQuestion);
  const values = await promptValuesWithProfile(i, null);
  const system = `${fillPrompt(s.prompts.questionPlan, values)}\n\n${planFormat(count, i.topics)}`;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await moduleAiChat(system, [{ role: "user", content: materialBlock(values) }], Math.min(4000, 400 + count * 160), {
        json: true,
        temperature: 0.6,
        timeoutMs: 90_000,
      });
      await addUsage(db, i.id, r);
      const parsed = planSchema.parse(parseJsonObject(r.text));
      const topics = new Map(i.topics.map((t) => [t.toLowerCase(), t]));
      const plan: PlannedQuestion[] = parsed.questions.slice(0, count).map((q, n) => ({
        no: n + 1,
        question: q.question,
        tip: q.tip,
        ...(q.topic && topics.has(q.topic.toLowerCase()) ? { topic: topics.get(q.topic.toLowerCase()) } : {}),
      }));
      return Object.assign(plan, { opening: parsed.opening });
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

/**
 * Open the interview: start a ready booking (writing the question plan), resume
 * an interrupted one inside its window, or rejoin one in progress. Returns an
 * error the candidate can read when it can't.
 */
export async function startInterview(userId: string, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await settleInterview(id);
  const now = new Date();
  const claimed = await db.transaction(async (tx) => {
    const i = await lockOwn(tx, userId, id);
    if (!i) return { error: "That interview isn't available." };
    if (i.status === "ready") {
      if (i.validUntil <= now) return { error: "This booking has expired." };
      await tx
        .update(aiInterviews)
        .set({ status: "in_progress", startedAt: now, lastActiveAt: now, activeSeconds: 0 })
        .where(eq(aiInterviews.id, id));
      await logEvent(tx, id, "start", `Started: ${i.category}, ${i.difficulty}, ${i.durationMin} min`, 0);
      return { row: { ...i, status: "in_progress" as const, startedAt: now, lastActiveAt: now } };
    }
    if (i.status === "interrupted") {
      const away = i.interruptedAt ? Math.max(1, Math.round((now.getTime() - i.interruptedAt.getTime()) / 60_000)) : 0;
      await tx.update(aiInterviews).set({ status: "in_progress", interruptedAt: null, lastActiveAt: now }).where(eq(aiInterviews.id, id));
      await logEvent(tx, id, "resume", `Resumed after ${away} minute${away === 1 ? "" : "s"}; clock picked up where it stopped`, i.activeSeconds);
      return { row: { ...i, status: "in_progress" as const, lastActiveAt: now } };
    }
    if (i.status === "in_progress") {
      // Rejoining (a reload or a second tab): the clock carries on as it was.
      return { row: i };
    }
    return { error: "This interview has finished." };
  });
  if ("error" in claimed) return { ok: false, error: claimed.error ?? "That interview isn't available." };
  const i = claimed.row;
  if (i.questionPlan?.length) return { ok: true };

  // First start: the AI writes the question plan, then asks the first question.
  let plan: PlannedQuestion[] & { opening?: string };
  try {
    plan = await writePlan(i);
  } catch (err) {
    // Nothing has happened yet, so the booking goes back to ready.
    await db.transaction(async (tx) => {
      await tx
        .update(aiInterviews)
        .set({ status: "ready", startedAt: null, lastActiveAt: null, activeSeconds: 0 })
        .where(and(eq(aiInterviews.id, id), isNull(aiInterviews.questionPlan)));
      await logEvent(tx, id, "error", `Question plan failed: ${aiErrorText(err)}`, 0);
    });
    return { ok: false, error: "We couldn't prepare your questions just now. Your booking is safe; try again in a minute." };
  }
  await db.transaction(async (tx) => {
    const fresh = await lockOwn(tx, userId, id);
    if (!fresh || fresh.questionPlan?.length) return;
    const first = plan[0];
    await tx
      .update(aiInterviews)
      .set({ questionPlan: plan.map(({ no, question, topic, tip }) => ({ no, question, tip, ...(topic ? { topic } : {}) })), questionsAsked: 1 })
      .where(eq(aiInterviews.id, id));
    await tx.insert(aiInterviewMessages).values({
      interviewId: id,
      seq: await nextSeq(tx, id),
      sender: "ai",
      kind: "question",
      questionNo: 1,
      text: `${plan.opening ? `${plan.opening} ` : ""}${first.question}`,
      clockSeconds: fresh.activeSeconds,
    });
    await logEvent(tx, id, "question", "Question 1 asked", fresh.activeSeconds);
  });
  return { ok: true };
}

/* ---------------- the clock ---------------- */

/** Count the time since the last heartbeat (or log a reconnection). Mutates `i`. */
async function tick(tx: Tx, i: Row, now: Date): Promise<void> {
  if (i.status !== "in_progress") return;
  const gap = i.lastActiveAt ? (now.getTime() - i.lastActiveAt.getTime()) / 1000 : 0;
  if (gap > DISCONNECT_SEC) {
    // The tab was there but offline: the clock stayed stopped meanwhile.
    await logEvent(tx, i.id, "disconnect", "Connection lost; clock paused", i.activeSeconds);
    await logEvent(tx, i.id, "resume", `Reconnected after ${Math.max(1, Math.round(gap / 60))} min`, i.activeSeconds);
  } else {
    i.activeSeconds += Math.round(Math.min(gap, BEAT_CAP_SEC));
  }
  i.lastActiveAt = now;
  const total = i.durationMin * 60;
  if (i.activeSeconds >= total && !i.wrapUpStartedAt) {
    i.wrapUpStartedAt = now;
    await logEvent(tx, i.id, "wrapup", "Time up; wrap-up started", i.activeSeconds);
  }
  await tx
    .update(aiInterviews)
    .set({ activeSeconds: i.activeSeconds, lastActiveAt: now, wrapUpStartedAt: i.wrapUpStartedAt })
    .where(eq(aiInterviews.id, i.id));
}

const overTime = (i: Row) => i.activeSeconds >= (i.durationMin + i.settings.wrapUpMinutes) * 60;

const CLOSING = "That's our time. Thank you for your answers today. Your report is being prepared and will be ready in a minute or two.";

/** End the interview now (time's up, the candidate ended it, or the AI closed it). */
async function finish(tx: Tx, i: Row, reason: string, closing: string | null): Promise<boolean> {
  const answers = await answersOf(tx, i.id);
  if (closing) {
    await tx.insert(aiInterviewMessages).values({
      interviewId: i.id,
      seq: await nextSeq(tx, i.id),
      sender: "ai",
      kind: "closing",
      // With no answers there's nothing to score, so the line mustn't promise a report.
      text: answers > 0 ? closing : "Thank you. We've stopped here. As no questions were answered, there's nothing to score this time.",
      clockSeconds: i.activeSeconds,
    });
  }
  const status = answers > 0 ? "completed" : "failed";
  await tx
    .update(aiInterviews)
    .set({ status, endedAt: new Date(), endReason: answers > 0 ? reason : `${reason}_no_answers` })
    .where(eq(aiInterviews.id, i.id));
  await logEvent(tx, i.id, "end", answers > 0 ? `Interview ended (${reason.replace(/_/g, " ")}) after ${i.questionsAsked} questions` : "Interview ended with no answers", i.activeSeconds);
  i.status = status;
  return answers > 0;
}

/** The interview screen's heartbeat, every 15 seconds while connected. */
export async function heartbeat(userId: string, id: string): Promise<LiveState | null> {
  let evaluate = false;
  const state = await db.transaction(async (tx) => {
    const i = await lockOwn(tx, userId, id);
    if (!i) return null;
    if (i.status === "in_progress") {
      await tick(tx, i, new Date());
      if (overTime(i)) evaluate = await finish(tx, i, "time_up", CLOSING);
    }
    return stateOf(i);
  });
  if (evaluate) later(() => evaluateInterview(id));
  return state;
}

/* ---------------- answers and the interviewer's turn ---------------- */

type Decision = { action: "follow_up" | "next_question" | "end"; message: string };

async function interviewerTurn(i: Row, plan: PlannedQuestion[], history: ChatTurn[], questionNo: number, followUps: number): Promise<Decision> {
  const s = await getModuleSettings();
  const wrappingUp = !!i.wrapUpStartedAt || i.activeSeconds >= i.durationMin * 60;
  const next = plan[questionNo] ?? null; // questionNo is 1-based, so this is the next one
  const state = {
    questionNo,
    totalQuestions: plan.length,
    followUpsOnQuestion: followUps,
    maxFollowUps: MAX_FOLLOW_UPS,
    nextQuestion: next?.question ?? null,
    wrappingUp,
    minutesLeft: Math.max(0, Math.round((i.durationMin * 60 - i.activeSeconds) / 60)),
  };
  const planText = plan.map((q) => `${q.no}. ${q.question}`).join("\n");
  // The system prompt and earlier turns stay identical from turn to turn, so
  // the provider can serve them from its cache; only the note on the latest
  // answer changes. The whole conversation is sent (an hour is ~60 messages):
  // trimming its start would change the prefix and lose the cache.
  const system = `${fillPrompt(s.prompts.interviewer, promptValues(i, plan))}\n\nThe planned questions:\n${planText}\n\n${turnRules(MAX_FOLLOW_UPS)}`;
  const turns = history.slice(-120);
  const last = turns.at(-1);
  if (last?.role === "user") turns[turns.length - 1] = { ...last, content: `${last.content}\n\n${turnNote(state)}` };

  let decision: Decision | null = null;
  for (let attempt = 0; attempt < 2 && !decision; attempt++) {
    try {
      const r = await moduleAiChat(system, turns, 500, { json: true, temperature: 0.5, timeoutMs: 45_000 });
      await addUsage(db, i.id, r);
      decision = turnSchema.parse(parseJsonObject(r.text));
    } catch (err) {
      if (attempt === 1) await logEvent(db, i.id, "error", `Interviewer reply failed: ${aiErrorText(err)}; used the plan instead`, i.activeSeconds);
    }
  }
  // The server keeps the rules whatever the reply says.
  if (!decision) decision = next && !wrappingUp ? { action: "next_question", message: `Thank you. Next question: ${next.question}` } : { action: "end", message: CLOSING };
  // With the plan done and time left, the interviewer keeps probing (no follow-up cap).
  const extraTime = !next && !wrappingUp && state.minutesLeft >= 3;
  if (decision.action === "follow_up" && followUps >= MAX_FOLLOW_UPS && !extraTime) {
    decision = next && !wrappingUp ? { action: "next_question", message: `Thank you. Next question: ${next.question}` } : { action: "end", message: CLOSING };
  }
  if (decision.action === "next_question" && (!next || wrappingUp)) decision = { action: "end", message: CLOSING };
  return decision;
}

/**
 * The candidate answers. The answer is saved first, then the interviewer
 * decides: a follow-up, the next planned question, or the end. Returns the new
 * messages for the screen.
 */
export async function submitAnswer(
  userId: string,
  id: string,
  text: string,
): Promise<{ ok: true; messages: NewMessage[]; state: LiveState } | { ok: false; error: string }> {
  const now = new Date();
  // 1. Save the answer (only when the interviewer is waiting for one).
  const saved = await db.transaction(async (tx) => {
    const i = await lockOwn(tx, userId, id);
    if (!i || i.status !== "in_progress" || !i.questionPlan?.length) return { error: "This interview isn't running." };
    const [last] = await tx
      .select()
      .from(aiInterviewMessages)
      .where(eq(aiInterviewMessages.interviewId, id))
      .orderBy(sql`${aiInterviewMessages.seq} desc`)
      .limit(1);
    if (!last || last.sender !== "ai" || last.kind === "closing") return { error: "Wait for the next question." };
    await tick(tx, i, now);
    const [m] = await tx
      .insert(aiInterviewMessages)
      .values({ interviewId: id, seq: last.seq + 1, sender: "candidate", kind: "answer", text, clockSeconds: i.activeSeconds })
      .returning();
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    await logEvent(tx, id, "answer", `Answer received (${wordCount} words)`, i.activeSeconds);
    return { row: i, answer: m };
  });
  if ("error" in saved) return { ok: false, error: saved.error ?? "This interview isn't running." };
  const i = saved.row;
  const out: NewMessage[] = [{ id: saved.answer.id, from: "you", text, at: saved.answer.clockSeconds, kind: "answer" }];

  if (overTime(i)) {
    const evaluate = await db.transaction(async (tx) => {
      const fresh = await lockOwn(tx, userId, id);
      return fresh && fresh.status === "in_progress" ? finish(tx, fresh, "time_up", CLOSING) : false;
    });
    if (evaluate) later(() => evaluateInterview(id));
    const [r] = await db.select().from(aiInterviews).where(eq(aiInterviews.id, id));
    return { ok: true, messages: [...out, { id: "closing", from: "ai", text: CLOSING, at: r.activeSeconds, kind: "closing" }], state: stateOf(r) };
  }

  // 2. The interviewer's turn (outside the lock: it can take a few seconds).
  const msgs = await db.select().from(aiInterviewMessages).where(eq(aiInterviewMessages.interviewId, id)).orderBy(asc(aiInterviewMessages.seq));
  const questionNo = msgs.reduce((n, m) => Math.max(n, m.questionNo ?? 0), 0);
  const lastQuestionAt = msgs.findLastIndex((m) => m.kind === "question");
  const followUps = msgs.slice(lastQuestionAt + 1).filter((m) => m.kind === "follow_up").length;
  const history: ChatTurn[] = msgs.map((m) => ({ role: m.sender === "ai" ? "assistant" : "user", content: m.text }));
  const decision = await interviewerTurn(i, i.questionPlan!, history, questionNo, followUps);

  // 3. Save it, unless something moved on meanwhile.
  let evaluate = false;
  const reply = await db.transaction(async (tx) => {
    const fresh = await lockOwn(tx, userId, id);
    if (!fresh || fresh.status !== "in_progress") return null;
    const seq = await nextSeq(tx, id);
    if (seq !== saved.answer.seq + 1) return null;
    if (decision.action === "end") {
      evaluate = await finish(tx, fresh, fresh.wrapUpStartedAt ? "time_up" : "finished", decision.message);
      return { id: "closing", from: "ai" as const, text: decision.message, at: fresh.activeSeconds, kind: "closing" as const, state: stateOf(fresh) };
    }
    const opens = decision.action === "next_question";
    const [m] = await tx
      .insert(aiInterviewMessages)
      .values({
        interviewId: id,
        seq,
        sender: "ai",
        kind: opens ? "question" : "follow_up",
        questionNo: opens ? questionNo + 1 : null,
        text: decision.message,
        clockSeconds: fresh.activeSeconds,
      })
      .returning();
    if (opens) await tx.update(aiInterviews).set({ questionsAsked: questionNo + 1 }).where(eq(aiInterviews.id, id));
    await logEvent(tx, id, opens ? "question" : "followup", opens ? `Question ${questionNo + 1} asked` : "Follow-up asked", fresh.activeSeconds);
    return {
      id: m.id,
      from: "ai" as const,
      text: m.text,
      at: m.clockSeconds,
      kind: (opens ? "question" : "follow_up") as NewMessage["kind"],
      ...(opens ? { questionNo: questionNo + 1 } : {}),
      state: stateOf(fresh),
    };
  });
  if (evaluate) later(() => evaluateInterview(id));
  if (!reply) {
    const [r] = await db.select().from(aiInterviews).where(eq(aiInterviews.id, id));
    return { ok: true, messages: out, state: stateOf(r) };
  }
  const { state, ...message } = reply;
  return { ok: true, messages: [...out, message], state };
}

/** The candidate ends the interview early (D10): what they answered is scored. */
export async function endInterview(userId: string, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  let evaluate = false;
  const ok = await db.transaction(async (tx) => {
    const i = await lockOwn(tx, userId, id);
    if (!i || (i.status !== "in_progress" && i.status !== "interrupted")) return false;
    if (i.status === "in_progress") await tick(tx, i, new Date());
    evaluate = await finish(tx, i, "ended_by_candidate", "Thank you. We've stopped here, and your report on the questions you answered is being prepared.");
    return true;
  });
  if (!ok) return { ok: false, error: "This interview isn't running." };
  if (evaluate) later(() => evaluateInterview(id));
  return { ok: true };
}

/* ---------------- the report ---------------- */

/**
 * Write the report (D49): one structured AI call, checked against the report
 * format and retried if the reply doesn't fit. Safe to call twice; the cron
 * job retries interviews whose report failed.
 */
export async function evaluateInterview(id: string): Promise<boolean> {
  const [i] = await db.select().from(aiInterviews).where(eq(aiInterviews.id, id));
  if (!i || (i.status !== "completed" && i.status !== "stopped")) return false;
  const [done] = await db.select({ id: interviewEvaluations.id }).from(interviewEvaluations).where(eq(interviewEvaluations.aiInterviewId, id));
  if (done) return true;

  const msgs = await db.select().from(aiInterviewMessages).where(eq(aiInterviewMessages.interviewId, id)).orderBy(asc(aiInterviewMessages.seq));
  if (!msgs.some((m) => m.sender === "candidate")) return false;
  const transcript = msgs
    .map((m) => (m.sender === "ai" ? `Interviewer${m.questionNo ? ` (question ${m.questionNo})` : ""}: ${m.text}` : `Candidate: ${m.text}`))
    .join("\n\n");
  const s = await getModuleSettings();
  const values = await promptValuesWithProfile(i, i.questionPlan);
  const system = `${fillPrompt(s.prompts.evaluation, values)}\n\n${evaluationFormat()}`;
  const user = `${materialBlock(values)}\n\nTranscript:\n\n${transcript.slice(0, 60_000)}`;

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await moduleAiChat(system, [{ role: "user", content: user }], 3500, { json: true, temperature: 0.2, timeoutMs: 120_000 });
      await addUsage(db, id, r);
      const e = evaluationSchema.parse(parseJsonObject(r.text));
      const overall = overallScore(e.scores, i.settings.weights);
      const inserted = await db
        .insert(interviewEvaluations)
        .values({
          userId: i.userId,
          source: "ai",
          aiInterviewId: id,
          status: "submitted",
          ...e.scores,
          weights: i.settings.weights,
          overall,
          writing: toWriting(e),
          submittedAt: new Date(),
        })
        .onConflictDoNothing({ target: interviewEvaluations.aiInterviewId })
        .returning({ id: interviewEvaluations.id });
      if (inserted.length) {
        await logEvent(db, id, "evaluation", `Report written (overall ${overall})`, i.activeSeconds);
        await sendReportEmail(i, overall).catch((err) => console.error("[mock-interviews] report email failed:", err instanceof Error ? err.message : err));
      }
      return true;
    } catch (err) {
      lastErr = err;
    }
  }
  await logEvent(db, id, "evaluation_failed", `Report couldn't be written: ${aiErrorText(lastErr)}`, i.activeSeconds);
  return false;
}

async function sendReportEmail(i: Row, overall: number) {
  const [u] = await db.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, i.userId));
  if (!u?.email) return;
  // Wording: admin Engagement → Email templates ("Interview report ready").
  await sendTemplateEmail("mock_interview_report", {
    to: u.email,
    values: { user_name: greetingName(u.name), interview_role: i.role, overall_score: String(overall) },
    buttonUrl: absoluteUrl(`/mock-interviews/report/${i.id}`),
  });
}

/* ---------------- the scheduled job ---------------- */

/**
 * Every 5 minutes (cron "interviews"): close dropped interviews past their
 * resume window, retry reports that failed, expire old bookings, send expiry
 * reminders and clear unpaid bookings. Safe to run twice.
 */
export async function runMockInterviewJob(): Promise<Record<string, number>> {
  const out = { settled: 0, reports: 0, expired: 0, reminders: 0, unpaidCleared: 0 };
  const now = new Date();

  // 1. Dropped connections and closed windows.
  const stale = await db
    .select({ id: aiInterviews.id })
    .from(aiInterviews)
    .where(
      sql`(${aiInterviews.status} = 'in_progress' and ${aiInterviews.lastActiveAt} < ${new Date(now.getTime() - DISCONNECT_SEC * 1000)})
        or ${aiInterviews.status} = 'interrupted'`,
    )
    .limit(200);
  for (const s of stale) {
    await settleInterview(s.id);
    out.settled++;
  }

  // 2. Reports still missing (a failed attempt, or a restart mid-write).
  const missing = await db
    .select({ id: aiInterviews.id })
    .from(aiInterviews)
    .leftJoin(interviewEvaluations, eq(interviewEvaluations.aiInterviewId, aiInterviews.id))
    .where(
      and(
        sql`${aiInterviews.status} in ('completed', 'stopped')`,
        isNull(interviewEvaluations.id),
        lt(aiInterviews.endedAt, new Date(now.getTime() - 2 * 60_000)),
        sql`(select count(*) from ${aiInterviewEvents} e where e.interview_id = ${aiInterviews.id} and e.kind = 'evaluation_failed') < ${MAX_EVALUATION_TRIES}`,
      ),
    )
    .limit(20);
  for (const m of missing) if (await evaluateInterview(m.id)) out.reports++;

  // 3. Bookings past their date.
  const expired = await db
    .update(aiInterviews)
    .set({ status: "expired" })
    .where(and(eq(aiInterviews.status, "ready"), lt(aiInterviews.validUntil, now)))
    .returning({ id: aiInterviews.id });
  out.expired = expired.length;

  // 4. "Your booking expires soon" (Module settings → Bookings; 0 sends none).
  const s = await getModuleSettings();
  if (s.expiryReminderDays > 0) {
    const due = await db
      .select({ i: aiInterviews, name: user.name, email: user.email })
      .from(aiInterviews)
      .innerJoin(user, eq(user.id, aiInterviews.userId))
      .where(
        and(
          eq(aiInterviews.status, "ready"),
          isNull(aiInterviews.expiryReminderSentAt),
          lt(aiInterviews.validUntil, new Date(now.getTime() + s.expiryReminderDays * 86_400_000)),
        ),
      )
      .limit(100);
    for (const { i, name, email } of due) {
      // Claim it first, so two runs never send twice.
      const claimed = await db
        .update(aiInterviews)
        .set({ expiryReminderSentAt: now })
        .where(and(eq(aiInterviews.id, i.id), isNull(aiInterviews.expiryReminderSentAt)))
        .returning({ id: aiInterviews.id });
      if (!claimed.length || !email) continue;
      const days = Math.max(1, Math.ceil((i.validUntil.getTime() - now.getTime()) / 86_400_000));
      try {
        await sendTemplateEmail("mock_interview_expiring", {
          to: email,
          values: {
            user_name: greetingName(name),
            interview_role: i.role,
            expires_on: i.validUntil.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Kolkata" }),
            expires_when: days === 1 ? "tomorrow" : `in ${days} days`,
          },
          buttonUrl: absoluteUrl(`/mock-interviews/ai/prepare/${i.id}`),
        });
        out.reminders++;
      } catch (err) {
        console.error("[mock-interviews] expiry reminder failed:", err instanceof Error ? err.message : err);
      }
    }
  }

  // 5. Bookings whose payment never went through (the order keeps its record).
  const cleared = await db
    .delete(aiInterviews)
    .where(
      and(
        eq(aiInterviews.status, "pending_payment"),
        lt(aiInterviews.createdAt, new Date(now.getTime() - 24 * 3_600_000)),
        sql`not exists (select 1 from payment_orders o where o.ai_interview_id = ${aiInterviews.id} and o.status = 'paid')`,
      ),
    )
    .returning({ id: aiInterviews.id });
  out.unpaidCleared = cleared.length;
  return out;
}
