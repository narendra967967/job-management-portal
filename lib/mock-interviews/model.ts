// Interview Preparation module: shared types and rules (docs/interview-prep/spec.md).
// Client-safe: no server imports. Used by the screens now and by the database and
// wiring phases later, so nothing here is sample data.

export const INTERVIEW_CATEGORIES = [
  "HR interview",
  "Technical interview",
  "Behavioral interview",
  "Managerial interview",
  "Product management",
  "Project management",
  "System design",
  "Coding",
  "Data analytics",
  "Leadership",
  "Case study",
  "Final round",
] as const;
export type InterviewCategory = (typeof INTERVIEW_CATEGORIES)[number];

/** Coding and System Design run as discussion interviews (D12). */
export const DISCUSSION_CATEGORIES: readonly InterviewCategory[] = ["Coding", "System design"];

export const INDUSTRIES = [
  "Information technology",
  "Banking and finance",
  "Consulting",
  "E-commerce and retail",
  "Healthcare",
  "Manufacturing",
  "Telecom",
  "Education",
  "Media and entertainment",
  "Government and public sector",
  "Other",
] as const;

export const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Allowed AI interview lengths in minutes; 60 is the maximum (D10). */
export const AI_DURATIONS = [15, 30, 45, 60] as const;
export type AiDuration = (typeof AI_DURATIONS)[number];

/** The five scored metrics, 1 to 10 each, shared by AI and human reports (D49). */
export const METRICS = [
  { key: "communication", label: "Communication" },
  { key: "technical", label: "Technical knowledge" },
  { key: "confidence", label: "Confidence and clarity" },
  { key: "problemSolving", label: "Problem-solving" },
  { key: "relevance", label: "Answer relevance" },
] as const;
export type MetricKey = (typeof METRICS)[number]["key"];
export type MetricScores = Record<MetricKey, number>;
export type MetricWeights = Record<MetricKey, number>;

/** One written point: a short headline shown on the report, and the full text
 *  shown on demand. Both are produced by the evaluator (AI or interviewer). */
export interface ReportPoint {
  headline: string;
  detail: string;
}

/** The five written parts of every report (D49). */
export interface ReportWriting {
  strengths: ReportPoint[];
  improvements: ReportPoint[];
  /** Questions answered wrongly or only partly: a short label and what was missing. */
  missed: { question: string; headline: string; note: string }[];
  /** A better way to answer, per question. */
  betterAnswers: { question: string; answer: string }[];
  nextSteps: ReportPoint[];
}

export type ReportSource = "ai" | "human";
export const SOURCE_LABELS: Record<ReportSource, string> = {
  ai: "AI evaluation",
  human: "Interviewer evaluation",
};

/** How many planned questions fit the duration (D10). Follow-ups come on top. */
export function plannedQuestions(durationMin: number, minutesPerQuestion: number): number {
  return Math.max(1, Math.floor(durationMin / Math.max(0.5, minutesPerQuestion)));
}

/** Admin pricing for one difficulty level (D5): a per-minute rate and its own discount. */
export interface DifficultyPricing {
  ratePerMinutePaise: number;
  discountOn: boolean;
  discountPercent: number; // 0-100, used only while discountOn
}
export type PricingByDifficulty = Record<Difficulty, DifficultyPricing>;

export interface AiInterviewQuote {
  /** Minutes times the level's rate, before any discount. Paise. */
  full: number;
  /** Discount applied, in percent (0 when the level's discount is off). */
  percent: number;
  /** What the candidate pays, rounded to the nearest rupee. Paise. */
  final: number;
}

/** Price of an interview outside the allowance (D5): duration times the
 *  difficulty's per-minute rate, less that level's discount when it's on,
 *  rounded to the nearest rupee. Prices include GST (D34). */
export function aiInterviewQuote(durationMin: number, p: DifficultyPricing): AiInterviewQuote {
  const full = Math.round(durationMin * Math.max(0, p.ratePerMinutePaise));
  const percent = p.discountOn ? Math.min(100, Math.max(0, p.discountPercent)) : 0;
  const final = Math.round((full * (100 - percent)) / 100 / 100) * 100;
  return { full, percent, final };
}

/** The lowest per-minute rate after discounts, for "from ₹3 a minute". Paise. */
export function lowestRatePerMinute(pricing: PricingByDifficulty): number {
  return Math.min(
    ...DIFFICULTIES.map((d) => {
      const p = pricing[d];
      return (p.ratePerMinutePaise * (100 - (p.discountOn ? Math.min(100, Math.max(0, p.discountPercent)) : 0))) / 100;
    }),
  );
}

/** Overall score out of 100 from 1-10 metric scores and admin weights (D49). */
export function overallScore(scores: MetricScores, weights: MetricWeights): number {
  const totalWeight = METRICS.reduce((s, m) => s + Math.max(0, weights[m.key]), 0) || 1;
  const weighted = METRICS.reduce((s, m) => s + scores[m.key] * Math.max(0, weights[m.key]), 0);
  return Math.round((weighted / totalWeight) * 10);
}

/** A word for an overall score, shown next to the number. */
export function scoreBand(overall: number): string {
  if (overall >= 85) return "Excellent";
  if (overall >= 70) return "Good";
  if (overall >= 50) return "Fair";
  return "Needs work";
}

/** Indian rupees from paise, e.g. 12000 → "₹120". */
export function rupees(paise: number): string {
  const r = paise / 100;
  return `₹${r.toLocaleString("en-IN", { maximumFractionDigits: r % 1 ? 2 : 0 })}`;
}

/** What the candidate has left before paying (D5). */
export type AllowanceState =
  | { kind: "free"; left: number } // Free plan: 1 interview, once ever
  | { kind: "plan"; planName: string; included: number; used: number; periodEnds: string }
  | { kind: "none" }; // nothing included: every interview is paid

export function allowanceLeft(a: AllowanceState): number {
  if (a.kind === "free") return a.left;
  if (a.kind === "plan") return Math.max(0, a.included - a.used);
  return 0;
}

/** "November 17, 2026" in the viewer's timezone. Render only after mount (timezone differs from the server's). */
export function longDate(iso: string): string {
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** "Nov 17, 2026" for tables. Render only after mount. */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ---------------- stored shapes (R1.4) ---------------- */

export type PartState = "open" | "coming_soon";

/** Status of one AI interview, from booking to the end (spec D13a–e). A paid
 *  booking waits in pending_payment until the payment is confirmed. */
export const AI_INTERVIEW_STATUSES = ["pending_payment", "ready", "in_progress", "interrupted", "completed", "stopped", "failed", "expired"] as const;
export type AiInterviewStatus = (typeof AI_INTERVIEW_STATUSES)[number];

/** How a booking was covered (D5): plan allowance, the Free plan's one, paid, or given back by admin. */
export const AI_COVERAGE = ["plan", "free", "paid", "credit"] as const;
export type AiCoverage = (typeof AI_COVERAGE)[number];

/** One planned question (D10): written by the AI at the start. The tip and
 *  topic show beside the conversation. */
export interface PlannedQuestion {
  no: number;
  question: string;
  /** The candidate's topic this question covers, if any. */
  topic?: string;
  tip: string;
}

/** The module settings in force when a booking was made (D36). Changing a
 *  setting later never changes this booking. */
export interface InterviewSettingsSnapshot {
  minutesPerQuestion: number;
  wrapUpMinutes: number;
  resumeWindowMinutes: number;
  paceGraceMinutes: number;
  bookingValidDays: number;
  pricing: DifficultyPricing;
  weights: MetricWeights;
}

export type AiProviderId = "openai" | "openrouter" | "anthropic";

/** Admin → Mock interviews → Module settings, as the screen edits it. The key
 *  itself never leaves the server: only its last 4 characters. */
export interface ModuleSettings {
  aiState: PartState;
  humanState: PartState;
  applicationsOpen: boolean;
  pauseBookings: boolean;
  provider: AiProviderId;
  model: string;
  keyLast4: string | null;
  /** What the provider charges, in paise per million tokens (admin-set). */
  inputCostPerMTokPaise: number;
  outputCostPerMTokPaise: number;
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

export const DEFAULT_PRICING: PricingByDifficulty = {
  Easy: { ratePerMinutePaise: 300, discountOn: false, discountPercent: 0 },
  Medium: { ratePerMinutePaise: 400, discountOn: false, discountPercent: 0 },
  Hard: { ratePerMinutePaise: 500, discountOn: false, discountPercent: 0 },
};

export const DEFAULT_WEIGHTS: MetricWeights = { communication: 20, technical: 20, confidence: 20, problemSolving: 20, relevance: 20 };

/** Built-in prompts; admin can replace each one (a blank or reset keeps these). */
export const DEFAULT_PROMPTS: ModuleSettings["prompts"] = {
  questionPlan:
    "You are planning a mock interview for a {{role}} in {{industry}}. Kind: {{category}}. Difficulty: {{difficulty}}. Plan {{question_count}} questions that cover the five scored skills and these topics: {{topics}}. Use the resume and job description below.",
  interviewer:
    "You are a professional interviewer. Ask one question at a time from the plan. Ask a follow-up only when an answer is thin or needs evidence. Keep a neutral, encouraging tone. Never give feedback during the interview.",
  evaluation:
    "Score the candidate 1 to 10 on communication, technical knowledge, confidence and clarity, problem-solving and answer relevance. For each written part give a short headline and the full text. Base everything on the transcript.",
};

export const PROMPT_PLACEHOLDERS = ["{{role}}", "{{industry}}", "{{category}}", "{{difficulty}}", "{{question_count}}", "{{topics}}", "{{resume}}", "{{job_description}}"];

/* ---------------- what the candidate screens read ---------------- */

/** A booking as the candidate sees it. "interrupted" can still be resumed. */
export type BookingStatus = "ready" | "in_progress" | "interrupted" | "completed" | "failed" | "expired";

export type BookingPayment =
  | { kind: "paid"; full: number; final: number; percent: number } // paise
  | { kind: "plan"; planName: string }
  | { kind: "free" }
  | { kind: "credit" };

export interface BookingRow {
  id: string;
  role: string;
  category: string;
  industry: string;
  difficulty: Difficulty;
  durationMin: number;
  topics: string[];
  bookedAt: string; // ISO
  validUntil: string; // ISO
  payment: BookingPayment;
  status: BookingStatus;
  /** Interrupted: minutes left to resume. */
  resumeMinutesLeft?: number;
  /** Completed with a report: the report to open. */
  reportId?: string;
}

/** One interview in History, Performance and report comparisons. */
export type InterviewStatus = "completed" | "awaiting_report" | "interrupted" | "in_progress" | "failed";

export interface InterviewSummary {
  id: string;
  source: ReportSource;
  role: string;
  category: string;
  industry: string;
  difficulty: Difficulty;
  durationMin: number;
  date: string; // ISO, when it started
  status: InterviewStatus;
  /** Present once the report exists, with the overall score it gave (out of 100). */
  scores?: MetricScores;
  overall?: number;
  interviewer?: string; // human interviews only
}

export interface ChatMessage {
  id: string;
  from: "ai" | "you";
  text: string;
  /** The planned question this message opens (shown as "Question n"). */
  questionNo?: number;
  /** Seconds into the interview when it was sent. */
  at?: number;
}
