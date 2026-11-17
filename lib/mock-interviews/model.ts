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

/** Price of an interview outside the allowance: per-minute rate times duration (D5). Paise. */
export function aiInterviewPrice(durationMin: number, ratePerMinutePaise: number): number {
  return Math.round(durationMin * ratePerMinutePaise);
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
