// Interview Preparation module: shared types and rules (docs/interview-prep/spec.md).
// Client-safe: no server imports. Used by the screens now and by the database and
// wiring phases later, so nothing here is sample data.

/**
 * The default kinds of interview for a new environment (admin edits the live
 * list in Module settings). Owner decision, November 24, 2026: only rounds that
 * work as a spoken one-on-one conversation. Coding, System design, Data
 * analytics and Case study were dropped because the real rounds need code, a
 * diagram or a chart.
 */
export const INTERVIEW_CATEGORIES = [
  "HR interview",
  "Recruiter screen",
  "Behavioral interview",
  "Managerial interview",
  "Technical concepts",
  "Product management",
  "Project management",
  "Leadership",
  "Stakeholder and client communication",
  "Sales and account management",
  "Customer success and support",
  "Guesstimates and problem-solving",
  "Salary and offer discussion",
  "Final round",
] as const;
export type InterviewCategory = (typeof INTERVIEW_CATEGORIES)[number];

/** Coding and System Design run as discussion interviews (D12), if an admin adds them back. */
export const DISCUSSION_CATEGORIES: readonly string[] = ["Coding", "System design"];

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

/** Suggested topics per kind of interview (the booking form's chips, and the
 *  fallback when "Suggest topics" finds little in a job description). */
export const TOPIC_SUGGESTIONS: Partial<Record<string, string[]>> = {
  "Project management": ["Risk management", "Stakeholder management", "Estimation", "Agile and Scrum", "Budget tracking"],
  "Product management": ["Prioritization", "Roadmaps", "Metrics", "User research", "Go-to-market"],
  "Behavioral interview": ["Conflict", "Failure and learning", "Leadership", "Teamwork", "Pressure and deadlines"],
  "Technical concepts": ["Past technical work", "Architecture choices", "Debugging approach", "Trade-offs", "Explaining to non-technical people"],
  "Recruiter screen": ["About yourself", "Why you're moving", "Notice period", "Expected CTC", "Why this company"],
  "Managerial interview": ["Team management", "Delegation", "Difficult conversations", "Hiring", "Performance issues"],
  Leadership: ["Vision and direction", "Influence", "Developing people", "Tough decisions", "Change management"],
  "Stakeholder and client communication": ["Managing expectations", "Saying no", "Escalations", "Difficult clients", "Status updates"],
  "Sales and account management": ["Your pitch", "Handling objections", "Pipeline and targets", "Closing", "Account growth"],
  "Customer success and support": ["Upset customers", "Escalations", "Renewals", "Onboarding", "Customer feedback"],
  "Guesstimates and problem-solving": ["Market sizing", "Estimation", "Structured thinking", "Root cause", "Prioritization"],
  "Salary and offer discussion": ["Expected CTC", "Current CTC", "Negotiating an offer", "Notice period", "Competing offers"],
  "HR interview": ["About yourself", "Strengths and weaknesses", "Career gaps", "Why this role", "Notice period"],
  // Earlier kinds, kept for older bookings.
  "Technical interview": ["Architecture", "Debugging", "Performance", "Testing", "Code review"],
  "System design": ["Scalability", "Caching", "Databases", "APIs", "Trade-offs"],
  Coding: ["Data structures", "Algorithms", "Complexity", "Problem breakdown"],
  "Data analytics": ["SQL", "Metrics", "A/B testing", "Dashboards", "Data cleaning"],
};
export const DEFAULT_TOPICS = ["Past projects", "Strengths and weaknesses", "Why this role", "Teamwork", "Problem-solving"];

/** Words that point to each industry, for guessing one from a lead's job description. */
const INDUSTRY_WORDS: [Exclude<(typeof INDUSTRIES)[number], "Other">, RegExp][] = [
  ["Banking and finance", /\bbank(s|ing)?\b|\bfintech\b|\bfinancial services\b|\binsurance\b|\bnbfc\b|\blending\b|\bpayments?\b|\bwealth\b|\bcapital markets\b/gi],
  ["Healthcare", /\bhealth ?care\b|\bhospitals?\b|\bpharma\w*|\bclinical\b|\bmedical\b|\bpatients?\b|\blife sciences\b/gi],
  ["E-commerce and retail", /\be-?commerce\b|\bretail\b|\bmarketplace\b|\bd2c\b|\bomnichannel\b|\bmerchandis\w*/gi],
  ["Telecom", /\btelecom\w*|\b5g\b|\bnetwork operators?\b|\bmobile operators?\b|\bisp\b/gi],
  ["Manufacturing", /\bmanufactur\w*|\bfactory\b|\bplants?\b|\bautomotive\b|\bproduction lines?\b|\bshop floor\b/gi],
  ["Education", /\beducation\b|\bedtech\b|\bschools?\b|\buniversit(y|ies)\b|\bstudents?\b|\blearners?\b/gi],
  ["Media and entertainment", /\bmedia\b|\bentertainment\b|\bott\b|\bstreaming\b|\bpublishing\b|\bbroadcast\w*/gi],
  ["Government and public sector", /\bgovernment\b|\bpublic sector\b|\bministry\b|\bpsu\b|\bmunicipal\b/gi],
  ["Consulting", /\bconsult(ing|ancy)\b|\badvisory\b|\bclient engagements?\b/gi],
  ["Information technology", /\bsoftware\b|\bsaas\b|\bcloud\b|\bit services\b|\btechnology company\b|\bproduct engineering\b/gi],
];

/**
 * The industry a job description most likely belongs to, or null when it can't
 * tell: the winner needs two mentions and a clear lead over the next one.
 */
export function guessIndustry(text: string): (typeof INDUSTRIES)[number] | null {
  if (!text.trim()) return null;
  const counts = INDUSTRY_WORDS.map(([name, re]) => ({ name, n: (text.match(re) ?? []).length })).sort((a, b) => b.n - a.n);
  const [first, second] = counts;
  return first.n >= 2 && first.n > second.n ? first.name : null;
}

/** The industry to show and give the AI: what the candidate typed when they picked Other. */
export const industryShown = (industry: string, other: string | null | undefined) => (industry === "Other" && other ? other : industry);

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

/**
 * The cheapest interview a candidate can book: every offered length at every
 * level, after discounts, exactly as booking charges it. For "a 15-minute one
 * starts at ₹11" (no level named).
 */
export function cheapestInterview(durations: number[], pricing: PricingByDifficulty): { durationMin: number; pricePaise: number } {
  let best = { durationMin: durations[0] ?? 15, pricePaise: Number.POSITIVE_INFINITY };
  for (const m of durations)
    for (const d of DIFFICULTIES) {
      const price = aiInterviewQuote(m, pricing[d]).final;
      if (price < best.pricePaise) best = { durationMin: m, pricePaise: price };
    }
  return Number.isFinite(best.pricePaise) ? best : { durationMin: best.durationMin, pricePaise: 0 };
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
  // ₹3, ₹4.50 (never ₹4.5).
  return `₹${r.toLocaleString("en-IN", r % 1 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 })}`;
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
  /** Cached input; 0 means charge it at the input price. */
  cachedInputCostPerMTokPaise: number;
  outputCostPerMTokPaise: number;
  categories: string[];
  /** Icon key admin chose per kind (components/mock-interviews/category-icons.ts); missing = the default. */
  categoryIcons: Record<string, string>;
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

export const PROMPT_PLACEHOLDERS = ["{{role}}", "{{company}}", "{{industry}}", "{{category}}", "{{difficulty}}", "{{question_count}}", "{{topics}}", "{{resume}}", "{{job_description}}", "{{career_profile}}"];

/* ---------------- what the candidate screens read ---------------- */

/** A booking as the candidate sees it. "interrupted" can still be resumed. */
/** no_answers: ended (or never resumed) before any answer, so there's nothing to score.
 *  failed: stopped by a problem on our side (the AI or the system). */
export type BookingStatus = "ready" | "in_progress" | "interrupted" | "completed" | "no_answers" | "failed" | "expired";

export type BookingPayment =
  // paise; orderId: the paid order, for its invoice (Orders & payments)
  | { kind: "paid"; full: number; final: number; percent: number; orderId?: string }
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
  /** Paused (interrupted): time away left, so minutes and seconds left to resume (D13f). */
  resumeMinutesLeft?: number;
  resumeSecondsLeft?: number;
  /** Completed with a report: the report to open. */
  reportId?: string;
}

/** One interview in History, Performance and report comparisons. */
export type InterviewStatus = "completed" | "awaiting_report" | "interrupted" | "in_progress" | "no_answers" | "failed";

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
  /** The lead it was booked for. id is null once the lead is deleted; the
   *  label ("Role at Company") is kept with the interview. */
  lead?: { id: string | null; label: string; company: string };
}

/** The company from a kept lead label ("Role at Company"), for leads since deleted. */
export function companyFromLabel(label: string): string {
  const at = label.lastIndexOf(" at ");
  return at >= 0 ? label.slice(at + 4).trim() : "";
}

export interface ChatMessage {
  id: string;
  from: "ai" | "you";
  text: string;
  /** The planned question this message opens (shown as "Question n"). */
  questionNo?: number;
  /** Seconds into the interview when it was sent. */
  at?: number;
  kind?: "question" | "follow_up" | "answer" | "closing";
}
