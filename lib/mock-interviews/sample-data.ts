// PHASE R1.2 SAMPLE DATA: the Mock interviews screens run on this until the
// database phase (R1.4) replaces it. Delete this file then. Nothing here is saved.

import type { AllowanceState, Difficulty, MetricScores, MetricWeights, ReportSource, ReportWriting } from "./model";

/** Module settings the screens need (admin sets these in R1.3/R1.4). */
export const SAMPLE_SETTINGS = {
  minutesPerQuestion: 2,
  ratePerMinutePaise: 400, // ₹4 a minute
  wrapUpMinutes: 10,
  resumeWindowMinutes: 15,
  weights: { communication: 20, technical: 20, confidence: 20, problemSolving: 20, relevance: 20 } satisfies MetricWeights,
};

/** Preview the allowance states with ?allowance=plan|free|none. */
export const SAMPLE_ALLOWANCES: Record<string, AllowanceState> = {
  plan: { kind: "plan", planName: "Premium", included: 3, used: 1, periodEnds: "2026-12-17" },
  free: { kind: "free", left: 1 },
  none: { kind: "none" },
};

export type SessionStatus = "completed" | "awaiting_report" | "interrupted" | "in_progress";

export interface SampleInterview {
  id: string;
  source: ReportSource;
  role: string;
  category: string;
  industry: string;
  difficulty: Difficulty;
  durationMin: number;
  date: string; // ISO
  status: SessionStatus;
  /** Present once the report exists. */
  scores?: MetricScores;
  interviewer?: string; // human interviews only
}

const s = (c: number, t: number, cf: number, p: number, r: number): MetricScores => ({
  communication: c,
  technical: t,
  confidence: cf,
  problemSolving: p,
  relevance: r,
});

export const SAMPLE_INTERVIEWS: SampleInterview[] = [
  { id: "ai-9", source: "ai", role: "Technical Project Manager", category: "Project management", industry: "Information technology", difficulty: "Medium", durationMin: 30, date: "2026-11-16T10:05:00+05:30", status: "interrupted" },
  { id: "ai-8", source: "ai", role: "Technical Project Manager", category: "Behavioral interview", industry: "Information technology", difficulty: "Medium", durationMin: 30, date: "2026-11-14T19:20:00+05:30", status: "completed", scores: s(8, 7, 7, 7, 8) },
  { id: "hu-2", source: "human", role: "Delivery Manager", category: "Managerial interview", industry: "Consulting", difficulty: "Hard", durationMin: 60, date: "2026-11-12T18:00:00+05:30", status: "awaiting_report", interviewer: "Ananya R." },
  { id: "ai-7", source: "ai", role: "Delivery Manager", category: "Leadership", industry: "Consulting", difficulty: "Hard", durationMin: 45, date: "2026-11-09T21:10:00+05:30", status: "completed", scores: s(7, 6, 7, 6, 7) },
  { id: "hu-1", source: "human", role: "Technical Project Manager", category: "Project management", industry: "Information technology", difficulty: "Medium", durationMin: 60, date: "2026-11-05T17:30:00+05:30", status: "completed", interviewer: "Rahul M.", scores: s(7, 6, 6, 7, 7) },
  { id: "ai-6", source: "ai", role: "Technical Project Manager", category: "Project management", industry: "Information technology", difficulty: "Medium", durationMin: 30, date: "2026-11-02T20:00:00+05:30", status: "completed", scores: s(7, 6, 6, 6, 7) },
  { id: "ai-5", source: "ai", role: "Scrum Master", category: "Behavioral interview", industry: "Banking and finance", difficulty: "Easy", durationMin: 15, date: "2026-10-28T08:45:00+05:30", status: "completed", scores: s(6, 6, 5, 6, 6) },
  { id: "ai-4", source: "ai", role: "Technical Project Manager", category: "System design", industry: "Information technology", difficulty: "Hard", durationMin: 45, date: "2026-10-24T22:15:00+05:30", status: "completed", scores: s(6, 5, 5, 6, 6) },
  { id: "ai-3", source: "ai", role: "Project Manager", category: "HR interview", industry: "E-commerce and retail", difficulty: "Easy", durationMin: 15, date: "2026-10-19T09:00:00+05:30", status: "completed", scores: s(6, 5, 5, 5, 6) },
  { id: "ai-2", source: "ai", role: "Project Manager", category: "Project management", industry: "E-commerce and retail", difficulty: "Medium", durationMin: 30, date: "2026-10-14T20:30:00+05:30", status: "completed", scores: s(5, 5, 4, 5, 5) },
  { id: "ai-1", source: "ai", role: "Project Manager", category: "Behavioral interview", industry: "E-commerce and retail", difficulty: "Easy", durationMin: 15, date: "2026-10-10T19:00:00+05:30", status: "completed", scores: s(5, 4, 4, 5, 5) },
];

export const SAMPLE_WRITING: Record<ReportSource, ReportWriting> = {
  ai: {
    strengths: [
      "Clear structure in most answers: you set the context, said what you did and finished with the result.",
      "Good use of real numbers when describing the payments migration (team size, timeline, cost saved).",
      "You stayed calm on the conflict question and owned your part of the problem.",
    ],
    improvements: [
      "Risk management answers stayed general. Name a real risk, how you spotted it and what you changed.",
      "Several answers ran past two minutes before reaching the point. Lead with the outcome, then explain.",
      "You described agile ceremonies well but not why you'd adapt them for a distributed team.",
    ],
    missed: [
      { question: "How do you decide when to escalate a delayed dependency?", note: "You described the follow-ups but not the trigger: what date or signal makes you escalate, and to whom." },
      { question: "Walk me through estimating a project with unclear requirements.", note: "Missing: ranges instead of single dates, and how you'd narrow them as you learn more." },
    ],
    betterAnswers: [
      {
        question: "How do you decide when to escalate a delayed dependency?",
        answer:
          "Set the escalation point when the dependency is agreed, for example two working days of slip on a critical-path item. When it's hit, raise it with the other team's lead first with the impact in dates, then with your sponsor if there's no plan within a day. Say what you need, not just that it's late.",
      },
      {
        question: "Walk me through estimating a project with unclear requirements.",
        answer:
          "Give a range, not a date: break the work into what's known and what isn't, estimate the known parts, add a discovery spike for the rest, and commit to narrowing the range after the spike. Share the assumptions in writing so changes are visible.",
      },
    ],
    nextSteps: [
      "Prepare two risk stories with a clear trigger, action and result.",
      "Practice answering in under 90 seconds: outcome first.",
      "Try a Hard difficulty Project management interview next.",
    ],
  },
  human: {
    strengths: [
      "Strong stakeholder examples, especially the vendor renegotiation.",
      "You asked good clarifying questions before the case discussion.",
    ],
    improvements: [
      "Budget questions: talk about variance and forecasting, not only tracking.",
      "Be more specific about your own decisions versus the team's.",
    ],
    missed: [
      { question: "A key engineer resigns two weeks before launch. What do you do?", note: "You covered hiring but not the short-term plan: knowledge transfer, scope cuts and telling stakeholders." },
    ],
    betterAnswers: [
      {
        question: "A key engineer resigns two weeks before launch. What do you do?",
        answer:
          "First, protect the launch: pair someone with them for handover this week, list what only they know, and agree what scope can move. Tell stakeholders the same day with options, not just the problem. Backfilling the role comes after the launch plan is safe.",
      },
    ],
    nextSteps: ["Prepare one budget-variance story.", "Practice the case format with a timer."],
  },
};

export interface ChatMessage {
  id: string;
  from: "ai" | "you";
  text: string;
  /** The planned question this message opens (shown as "Question n"). */
  questionNo?: number;
  /** Seconds into the interview when it was sent. */
  at?: number;
}

/** The session the interview screen shows (R1.5: from the session row). */
export const SAMPLE_SESSION = {
  role: "Technical Project Manager",
  category: "Project management",
  difficulty: "Medium",
  durationMin: 30,
  /** Topics the candidate asked for, and the planned question that covers each. */
  topics: [
    { name: "Risk management", question: 1 },
    { name: "Stakeholder management", question: 2 },
    { name: "Estimation", question: 3 },
    { name: "Agile and Scrum", question: 5 },
  ],
};

/** One tip per planned question, shown beside the conversation. */
export const SAMPLE_TIPS = [
  "Lead with the outcome, then explain how you got there.",
  "Name the trigger: what date or signal made you act, and who you told.",
  "Give a range, not one date, and say what would narrow it.",
  "Use one real example. Situation, what you did, and the result.",
];

export const SAMPLE_CHAT: ChatMessage[] = [
  { id: "m1", from: "ai", questionNo: 1, at: 5, text: "Thanks for joining. Let's start with an overview: tell me about a project you led from start to finish, and what it delivered." },
  { id: "m2", from: "you", at: 78, text: "I led the migration of our payments service to a new provider. Eight engineers, five months. We cut transaction costs by about 18% and had no downtime during the switch." },
  { id: "m3", from: "ai", at: 84, text: "What was the biggest risk in that migration, and how did you handle it?" },
  { id: "m4", from: "you", at: 161, text: "Double charging during the cutover. We ran both providers in parallel for two weeks with a reconciliation job and a kill switch." },
  { id: "m5", from: "ai", questionNo: 2, at: 168, text: "Good. Next one: how do you decide when to escalate a delayed dependency from another team?" },
];

/** Canned follow-ups the sample interviewer cycles through when you answer. */
export const SAMPLE_FOLLOW_UPS = [
  "Can you give me a specific example of when you did that?",
  "What would you do differently if you ran it again?",
  "How did you measure whether it worked?",
  "Thanks. Next question: walk me through how you estimate a project when the requirements are unclear.",
];

export function sampleInterview(id: string): SampleInterview | undefined {
  return SAMPLE_INTERVIEWS.find((i) => i.id === id);
}
