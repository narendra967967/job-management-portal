// PHASE R1.3 SAMPLE DATA for the admin Mock interviews screens. The database
// phase (R1.4) replaces it; delete this file then. Nothing here is saved.

import { INTERVIEW_CATEGORIES, AI_DURATIONS, type Difficulty, type PricingByDifficulty, type MetricWeights } from "./model";
import { SAMPLE_SETTINGS } from "./sample-data";

export type PartState = "open" | "coming_soon";
export type AiProvider = "openai" | "openrouter" | "anthropic";

export interface ModuleSettings {
  aiState: PartState;
  humanState: PartState;
  applicationsOpen: boolean;
  pauseBookings: boolean;
  provider: AiProvider;
  model: string;
  keyLast4: string | null;
  categories: string[];
  durations: number[];
  minutesPerQuestion: number;
  wrapUpMinutes: number;
  resumeWindowMinutes: number;
  paceGraceMinutes: number;
  bookingValidDays: number;
  expiryReminderDays: number;
  pricing: PricingByDifficulty;
  weights: MetricWeights;
  prompts: { questionPlan: string; interviewer: string; evaluation: string };
}

export const SAMPLE_MODULE_SETTINGS: ModuleSettings = {
  aiState: "coming_soon",
  humanState: "coming_soon",
  applicationsOpen: false,
  pauseBookings: false,
  provider: "openrouter",
  model: "",
  keyLast4: "7f2a",
  categories: [...INTERVIEW_CATEGORIES],
  durations: [...AI_DURATIONS],
  minutesPerQuestion: SAMPLE_SETTINGS.minutesPerQuestion,
  wrapUpMinutes: SAMPLE_SETTINGS.wrapUpMinutes,
  resumeWindowMinutes: SAMPLE_SETTINGS.resumeWindowMinutes,
  paceGraceMinutes: SAMPLE_SETTINGS.paceGraceMinutes,
  bookingValidDays: 30,
  expiryReminderDays: 3,
  pricing: SAMPLE_SETTINGS.pricing,
  weights: SAMPLE_SETTINGS.weights,
  prompts: {
    questionPlan:
      "You are planning a mock interview for a {{role}} in {{industry}}. Kind: {{category}}. Difficulty: {{difficulty}}. Plan {{question_count}} questions that cover the five scored skills and these topics: {{topics}}. Use the resume and job description below.",
    interviewer:
      "You are a professional interviewer. Ask one question at a time from the plan. Ask a follow-up only when an answer is thin or needs evidence. Keep a neutral, encouraging tone. Never give feedback during the interview.",
    evaluation:
      "Score the candidate 1 to 10 on communication, technical knowledge, confidence and clarity, problem-solving and answer relevance. For each written part give a short headline and the full text. Base everything on the transcript.",
  },
};

export const PROMPT_PLACEHOLDERS = ["{{role}}", "{{industry}}", "{{category}}", "{{difficulty}}", "{{question_count}}", "{{topics}}", "{{resume}}", "{{job_description}}"];

/* ---------------- sessions (usage) ---------------- */

export type AdminSessionStatus = "completed" | "stopped" | "in_progress" | "failed";

export interface AdminSession {
  id: string;
  startedAt: string; // ISO
  user: { name: string; email: string };
  role: string;
  category: string;
  difficulty: Difficulty;
  durationMin: number;
  status: AdminSessionStatus;
  questions: number;
  tokensIn: number;
  tokensOut: number;
  costPaise: number; // what the AI calls cost Jobtiva
  payment: { kind: "paid"; paise: number } | { kind: "plan" } | { kind: "free" };
  credited?: { at: string; note: string };
}

const USERS = [
  { name: "Asha Verma", email: "asha.verma@example.com" },
  { name: "Rohan Mehta", email: "rohan.m@example.com" },
  { name: "Priya Nair", email: "priya.nair@example.com" },
  { name: "Karan Shah", email: "karan.shah@example.com" },
  { name: "Neha Iyer", email: "neha.iyer@example.com" },
  { name: "Vikram Rao", email: "vikram.rao@example.com" },
  { name: "Sara Thomas", email: "sara.t@example.com" },
  { name: "UI Test", email: "ui-test@jobtiva.test" },
];
const ROLES = ["Technical Project Manager", "Product Manager", "Data Analyst", "Software Engineer", "Scrum Master", "Delivery Manager", "Business Analyst"];
const LEVELS: Difficulty[] = ["Easy", "Medium", "Hard"];
const STATUSES: AdminSessionStatus[] = ["completed", "completed", "completed", "completed", "stopped", "completed", "in_progress", "completed", "failed", "completed"];

/** 90 deterministic sample sessions over the last 30 days. */
export const SAMPLE_SESSIONS: AdminSession[] = Array.from({ length: 90 }, (_, i) => {
  const day = Math.floor((((i * 37) % 101) / 101) * 30 * (i % 4 ? 1 : 0.5)); // busier lately
  const date = new Date(Date.UTC(2026, 10, 17, 14 - (i % 9), (i * 17) % 60) - day * 86_400_000);
  const durationMin = AI_DURATIONS[i % AI_DURATIONS.length];
  const difficulty = LEVELS[(i * 2) % 3];
  const status = STATUSES[i % STATUSES.length];
  const share = status === "completed" ? 1 : status === "stopped" ? 0.55 : status === "in_progress" ? 0.3 : 0.1;
  const questions = Math.round((durationMin / 2) * share);
  const tokensIn = Math.round((9_000 + durationMin * 900) * share);
  const tokensOut = Math.round((1_800 + durationMin * 160) * share);
  const costPaise = Math.round((tokensIn * 0.012 + tokensOut * 0.048) * 0.9);
  const pricing = SAMPLE_SETTINGS.pricing[difficulty];
  const payKind = i % 3 === 0 ? "plan" : i % 7 === 0 ? "free" : "paid";
  return {
    id: `ses-${100 + i}`,
    startedAt: date.toISOString(),
    user: USERS[(i * 5) % USERS.length],
    role: ROLES[i % ROLES.length],
    category: INTERVIEW_CATEGORIES[(i * 3) % INTERVIEW_CATEGORIES.length],
    difficulty,
    durationMin,
    status,
    questions,
    tokensIn,
    tokensOut,
    costPaise,
    payment:
      payKind === "plan"
        ? { kind: "plan" }
        : payKind === "free"
          ? { kind: "free" }
          : { kind: "paid", paise: Math.round((durationMin * pricing.ratePerMinutePaise * (100 - (pricing.discountOn ? pricing.discountPercent : 0))) / 100 / 100) * 100 },
    ...(i === 8 ? { credited: { at: date.toISOString(), note: "The AI service timed out twice; gave the interview back." } } : {}),
  };
});

export interface SessionEvent {
  at: string; // "mm:ss" into the interview
  kind: "start" | "question" | "answer" | "followup" | "disconnect" | "resume" | "wrapup" | "end" | "evaluation" | "error";
  text: string;
}

/** A believable event log for one session (R1.5 records the real one). */
export function sampleEvents(s: AdminSession): SessionEvent[] {
  const ev: SessionEvent[] = [
    { at: "0:00", kind: "start", text: `Started: ${s.category}, ${s.difficulty}, ${s.durationMin} min` },
    { at: "0:04", kind: "question", text: "Question 1 asked" },
    { at: "1:18", kind: "answer", text: "Answer received (52 words)" },
    { at: "1:24", kind: "followup", text: "Follow-up asked" },
    { at: "2:41", kind: "answer", text: "Answer received (38 words)" },
    { at: "2:48", kind: "question", text: "Question 2 asked" },
  ];
  if (s.status === "stopped") {
    ev.push({ at: "6:10", kind: "disconnect", text: "Connection lost; clock paused" });
    ev.push({ at: "6:10", kind: "end", text: "Not resumed within 15 minutes; interview closed with the answers so far" });
    ev.push({ at: "6:10", kind: "evaluation", text: "Report generated from the answers so far" });
  } else if (s.status === "failed") {
    ev.push({ at: "3:02", kind: "error", text: "AI service didn't respond (timeout), retried" });
    ev.push({ at: "3:33", kind: "error", text: "AI service didn't respond (timeout); interview stopped" });
  } else if (s.status === "in_progress") {
    ev.push({ at: "4:30", kind: "disconnect", text: "Connection lost; clock paused" });
    ev.push({ at: "4:30", kind: "resume", text: "Resumed after 3 minutes; clock picked up at 4:30" });
  } else {
    ev.push({ at: `${s.durationMin - 1}:40`, kind: "wrapup", text: "Time up; wrap-up started" });
    ev.push({ at: `${s.durationMin + 2}:05`, kind: "end", text: `Interview ended after ${s.questions} questions` });
    ev.push({ at: `${s.durationMin + 2}:31`, kind: "evaluation", text: "Report generated" });
  }
  return ev;
}
