import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { mockInterviewConfig } from "@/db/schema";
import {
  AI_DURATIONS,
  DEFAULT_PRICING,
  DEFAULT_PROMPTS,
  DEFAULT_WEIGHTS,
  INTERVIEW_CATEGORIES,
  type Difficulty,
  type InterviewSettingsSnapshot,
  type ModuleSettings,
} from "./model";
import { AI_INTERVIEWS_WIRED } from "./preview";

// Admin → Mock interviews → Module settings, read on the server. The single
// "app" row is created on the first save; until then the defaults apply.

type ConfigRow = typeof mockInterviewConfig.$inferSelect;

export const MODULE_DEFAULTS: ModuleSettings = {
  aiState: "coming_soon",
  humanState: "coming_soon",
  applicationsOpen: false,
  pauseBookings: false,
  provider: "openai",
  model: "",
  keyLast4: null,
  inputCostPerMTokPaise: 0,
  cachedInputCostPerMTokPaise: 0,
  outputCostPerMTokPaise: 0,
  categories: [...INTERVIEW_CATEGORIES],
  durations: [...AI_DURATIONS],
  minutesPerQuestion: 2,
  wrapUpMinutes: 10,
  resumeWindowMinutes: 15,
  paceGraceMinutes: 5,
  bookingValidDays: 30,
  expiryReminderDays: 3,
  pricing: DEFAULT_PRICING,
  weights: DEFAULT_WEIGHTS,
  prompts: DEFAULT_PROMPTS,
};

function toSettings(r: ConfigRow | undefined): ModuleSettings {
  if (!r) return MODULE_DEFAULTS;
  return {
    aiState: r.aiState === "open" ? "open" : "coming_soon",
    humanState: r.humanState === "open" ? "open" : "coming_soon",
    applicationsOpen: r.applicationsOpen,
    pauseBookings: r.pauseBookings,
    provider: r.aiProvider,
    model: r.aiModel ?? "",
    keyLast4: r.aiKeyCiphertext ? r.aiKeyLast4 : null,
    inputCostPerMTokPaise: r.aiInputCostPerMTokPaise,
    cachedInputCostPerMTokPaise: r.aiCachedInputCostPerMTokPaise,
    outputCostPerMTokPaise: r.aiOutputCostPerMTokPaise,
    categories: r.categories.length ? r.categories : MODULE_DEFAULTS.categories,
    durations: r.durations.length ? [...r.durations].sort((a, b) => a - b) : MODULE_DEFAULTS.durations,
    minutesPerQuestion: r.minutesPerQuestion,
    wrapUpMinutes: r.wrapUpMinutes,
    resumeWindowMinutes: r.resumeWindowMinutes,
    paceGraceMinutes: r.paceGraceMinutes,
    bookingValidDays: r.bookingValidDays,
    expiryReminderDays: r.expiryReminderDays,
    pricing: { ...DEFAULT_PRICING, ...r.pricing },
    weights: { ...DEFAULT_WEIGHTS, ...r.weights },
    prompts: {
      questionPlan: r.promptQuestionPlan || DEFAULT_PROMPTS.questionPlan,
      interviewer: r.promptInterviewer || DEFAULT_PROMPTS.interviewer,
      evaluation: r.promptEvaluation || DEFAULT_PROMPTS.evaluation,
    },
  };
}

export async function getModuleSettings(): Promise<ModuleSettings> {
  const [r] = await db.select().from(mockInterviewConfig).where(eq(mockInterviewConfig.id, "app"));
  return toSettings(r);
}

/**
 * Whether candidates see AI interviews. Admin's Open switch decides; until the
 * interviewer is wired (roadmap R1.5) production keeps Coming soon whatever the
 * switch says, so nobody books an interview that can't run yet.
 */
export function aiInterviewsOpen(s: Pick<ModuleSettings, "aiState">): boolean {
  return s.aiState === "open" && (AI_INTERVIEWS_WIRED || process.env.NODE_ENV !== "production");
}

export async function candidateAiOpen(): Promise<boolean> {
  return aiInterviewsOpen(await getModuleSettings());
}

/** The settings a new booking keeps for itself (D36). */
export function settingsSnapshot(s: ModuleSettings, difficulty: Difficulty): InterviewSettingsSnapshot {
  return {
    minutesPerQuestion: s.minutesPerQuestion,
    wrapUpMinutes: s.wrapUpMinutes,
    resumeWindowMinutes: s.resumeWindowMinutes,
    paceGraceMinutes: s.paceGraceMinutes,
    bookingValidDays: s.bookingValidDays,
    pricing: s.pricing[difficulty],
    weights: s.weights,
  };
}
