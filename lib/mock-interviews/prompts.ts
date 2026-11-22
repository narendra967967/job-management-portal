import "server-only";

import { z } from "zod";
import { METRICS, type ReportWriting } from "./model";

// The three AI calls of an interview (spec D10, D49): the question plan, each
// interviewer turn, and the evaluation. Admin edits the wording of each prompt
// (Module settings → Prompts); the reply format below is owned by the code, so
// an edited prompt can't break the parsing.

export interface PromptValues {
  role: string;
  industry: string;
  category: string;
  difficulty: string;
  question_count: number;
  topics: string;
  resume: string;
  job_description: string;
  /** The candidate's career profile (target roles, skills, experience), or "". */
  career_profile: string;
}

/**
 * What {{topics}} becomes when the candidate chose none (topics are optional):
 * it reads naturally in the admin's plan prompt ("...and these topics: ...").
 */
export const NO_TOPICS = "none chosen, so cover the main areas of the role, the job description and the resume";

/** Fill {{placeholders}}; unknown ones are left as typed. */
export function fillPrompt(template: string, v: PromptValues): string {
  return template.replace(/\{\{(\w+)\}\}/g, (all, key: string) => (key in v ? String(v[key as keyof PromptValues]) : all));
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** The candidate's material, appended to the question plan prompt. */
export function materialBlock(v: PromptValues): string {
  return [
    `Role: ${v.role}`,
    `Industry: ${v.industry}`,
    `Kind of interview: ${v.category}`,
    `Difficulty: ${v.difficulty}`,
    `Topics the candidate wants covered: ${v.topics || NO_TOPICS}`,
    "",
    ...(v.career_profile ? ["", "Career profile:", clip(v.career_profile, 4_000)] : []),
    "",
    "Resume:",
    clip(v.resume, 12_000) || "(none)",
    "",
    "Job description:",
    clip(v.job_description, 12_000) || "(none: general preparation for the role)",
  ].join("\n");
}

/* ---------------- 1. question plan ---------------- */

export function planFormat(count: number, topics: string[]): string {
  return [
    "Reply with one JSON object only, in this shape:",
    '{"opening": string, "questions": [{"question": string, "topic": string | null, "skill": string, "tip": string}]}',
    `- "questions": exactly ${count} items, in the order they'll be asked, easiest first.`,
    topics.length
      ? `- "topic": one of ${JSON.stringify(topics)} when the question covers it, otherwise null. Cover every topic at least once.`
      : '- "topic": always null. The candidate chose no topics, so spread the questions across the main areas of the role, the job description and the resume.',
    `- "skill": the main skill it tests, one of ${JSON.stringify(METRICS.map((m) => m.key))}. Spread them.`,
    '- "tip": one short sentence of advice for answering that question well, written to the candidate.',
    '- "opening": one or two friendly sentences that welcome the candidate before the first question. Don\'t ask a question in it.',
    "- Plain text in every field: no Markdown, no numbering.",
  ].join("\n");
}

export const planSchema = z.object({
  opening: z.string().trim().min(1).max(600),
  questions: z
    .array(
      z.object({
        question: z.string().trim().min(5).max(600),
        topic: z.string().trim().max(60).nullable().optional(),
        skill: z.string().trim().max(40).optional(),
        tip: z.string().trim().min(1).max(300),
      }),
    )
    .min(1)
    .max(40),
});

/* ---------------- 2. interviewer turn ---------------- */

export interface TurnState {
  questionNo: number;
  totalQuestions: number;
  followUpsOnQuestion: number;
  maxFollowUps: number;
  nextQuestion: string | null;
  wrappingUp: boolean;
  minutesLeft: number;
}

/**
 * The interviewer's standing rules. They go in the system prompt and never
 * change during an interview, so together with the conversation so far they
 * form a stable prefix the provider can cache (much cheaper input).
 */
export function turnRules(maxFollowUps: number): string {
  return [
    "How each turn works:",
    "After every candidate answer you get a short note in [brackets] saying where the interview stands. The candidate doesn't see it. Decide what happens next, then reply with one JSON object only:",
    '{"action": "follow_up" | "next_question" | "end", "message": string}',
    `- follow_up: one short follow-up on the same question, only when the answer is thin, vague or lacks evidence you'd need to score it. At most ${maxFollowUps} per question, except once every planned question is done.`,
    "- next_question: a brief, natural transition (no praise or feedback on the last answer), then the next planned question named in the note, kept in meaning.",
    "- end: one or two sentences thanking the candidate and saying their report is being prepared. Only when the note allows it (time is up, or the plan is done and little time is left), or the candidate asks to stop.",
    "- Never give feedback, hints or scores during the interview. Plain text, no Markdown, under 90 words.",
  ].join("\n");
}

/** Where the interview stands now, added to the candidate's latest answer (the only part that changes each turn). */
export function turnNote(s: TurnState): string {
  const parts = [`Planned question ${s.questionNo} of ${s.totalQuestions}; follow-ups on it so far: ${s.followUpsOnQuestion} of ${s.maxFollowUps}.`];
  if (s.wrappingUp) parts.push("Time is up: don't start a new planned question. Ask one last short follow-up to finish this one, or end.");
  else if (s.nextQuestion) parts.push(`About ${s.minutesLeft} minutes left. Next planned question: "${s.nextQuestion}"`);
  else if (s.minutesLeft >= 3)
    parts.push(
      `Every planned question is done, with about ${s.minutesLeft} minutes left. Use the time: ask a follow-up, or a new related question that digs into the area where the candidate's answers were thinnest (action follow_up). Don't end unless the candidate asks to stop.`,
    );
  else parts.push("That was the last planned question: ask a follow-up if it's needed, otherwise end.");
  return `[Interviewer note, not from the candidate: ${parts.join(" ")}]`;
}

export const turnSchema = z.object({
  action: z.enum(["follow_up", "next_question", "end"]),
  message: z.string().trim().min(1).max(1500),
});

/* ---------------- 3. evaluation ---------------- */

const point = z.object({ headline: z.string().trim().min(1).max(90), detail: z.string().trim().min(1).max(1200) });
const score = z.number().int().min(1).max(10);

export const evaluationSchema = z.object({
  scores: z.object({ communication: score, technical: score, confidence: score, problemSolving: score, relevance: score }),
  strengths: z.array(point).min(1).max(30),
  improvements: z.array(point).min(1).max(30),
  missed: z
    .array(z.object({ question: z.string().trim().min(1).max(600), headline: z.string().trim().min(1).max(90), note: z.string().trim().min(1).max(1200) }))
    .max(60),
  betterAnswers: z.array(z.object({ question: z.string().trim().min(1).max(600), answer: z.string().trim().min(1).max(2000) })).max(60),
  nextSteps: z.array(point).min(1).max(30),
});
export type EvaluationReply = z.infer<typeof evaluationSchema>;

export function evaluationFormat(): string {
  return [
    "Reply with one JSON object only, in this shape:",
    '{"scores": {"communication": n, "technical": n, "confidence": n, "problemSolving": n, "relevance": n},',
    ' "strengths": [{"headline": string, "detail": string}],',
    ' "improvements": [{"headline": string, "detail": string}],',
    ' "missed": [{"question": string, "headline": string, "note": string}],',
    ' "betterAnswers": [{"question": string, "answer": string}],',
    ' "nextSteps": [{"headline": string, "detail": string}]}',
    "- Each score is a whole number from 1 to 10, judged only on what the candidate said in the transcript. The resume is context, not evidence.",
    "- Use the full scale, strictly, as a demanding interviewer would: 1-2 no relevant answer; 3-4 vague, generic or largely wrong, with no real example; 5-6 relevant but general or partial, few specifics; 7-8 specific and structured, with a real example and its result; 9-10 exceptional, complete on every part, with measurable results and clear reasoning.",
    "- A short, vague or generic answer can't lift a score above 4. 'I'm not sure' counts against technical knowledge and confidence. An average answer is a 5. A well-prepared candidate who answers with specific examples and their results earns 7 to 8; give 9 or 10 only when nearly every answer is exceptional.",
    "- headline: a short label of 2 to 6 words in sentence case (only the first word capitalized, e.g. \"Give a specific example\"). detail / note / answer: the full explanation, specific to this candidate's answers, written to the candidate as \"you\".",
    "- missed: questions answered wrongly or only partly, with what was missing, at most 8 and the most important first. betterAnswers: a stronger answer for each of those, in the same order.",
    "- strengths, improvements and nextSteps: 1 to 4 items each. Plain text in every field, no Markdown.",
    "- Questions the candidate never reached aren't failures; don't list them as missed.",
  ].join("\n");
}

/**
 * The written parts, trimmed to what the report shows. A reply that lists more
 * (common for a weak interview with many thin answers) is kept and cut down,
 * rather than failing the whole report.
 */
export function toWriting(r: EvaluationReply): ReportWriting {
  return {
    strengths: r.strengths.slice(0, 4),
    improvements: r.improvements.slice(0, 4),
    missed: r.missed.slice(0, 8),
    betterAnswers: r.betterAnswers.slice(0, 8),
    nextSteps: r.nextSteps.slice(0, 4),
  };
}

/** The first JSON object in a reply (some models wrap it in prose or a code fence). */
export function parseJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in the reply");
  return JSON.parse(text.slice(start, end + 1));
}
