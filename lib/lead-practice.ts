// Practice interviews as the lead side sees them (docs/lead-interview-link/roadmap.md).
// Client-safe: the server builds WorkspacePractice in loadWorkspace and the lead
// screens read it from the workspace store.

/** Where one practice for a lead stands, from the candidate's side. */
export type PracticeState =
  | "booked" // paid or covered, not started yet
  | "in_progress"
  | "paused" // dropped, can still be resumed
  | "awaiting_report"
  | "completed" // report ready, has a score
  | "ended"; // ended early with nothing to score, or stopped by a problem

export interface LeadPracticeRun {
  id: string;
  state: PracticeState;
  difficulty: string;
  durationMin: number;
  /** When it started (or was booked, if it hasn't started), ISO. */
  date: string;
  /** Overall score out of 100, once the report is ready. */
  score: number | null;
  /** The report's first two "things to improve" headlines. */
  fixes: string[];
}

export interface WorkspacePractice {
  /** AI mock interviews are open to candidates (Module settings). Everything
   *  practice-related on the lead side hides while they're Coming soon. */
  open: boolean;
  /** Each lead's practices, newest first. Leads with none are missing. */
  byLead: Record<string, LeadPracticeRun[]>;
}

export const NO_PRACTICE: WorkspacePractice = { open: false, byLead: {} };

export interface LeadReadiness {
  /** Practices with a report (scored). */
  scored: number;
  /** Practices that count as done: scored, or with the report on its way. */
  practiced: number;
  latest: { id: string; score: number; date: string } | null;
  /** The scored practice before the latest one. */
  previous: number | null;
  /** Latest against previous, in percent of the previous score (rounded). */
  changePct: number | null;
  /** A booked or unfinished practice the candidate can start or resume. */
  open: LeadPracticeRun | null;
}

/** Readiness for one lead (owner, November 24, 2026: the latest score, with
 *  the change from the one before it in percent). */
export function leadReadiness(runs: LeadPracticeRun[] | undefined): LeadReadiness {
  const list = runs ?? [];
  const scored = list
    .filter((r) => r.state === "completed" && r.score !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
  const latest = scored[0];
  const previous = scored[1]?.score ?? null;
  // Rounded by size, then signed: 80 → 70 is "down 13%", not "down 12%".
  const raw = latest && previous !== null && previous > 0 ? ((latest.score! - previous) / previous) * 100 : null;
  const changePct = raw === null ? null : Math.sign(raw) * Math.round(Math.abs(raw));
  return {
    scored: scored.length,
    practiced: list.filter((r) => r.state === "completed" || r.state === "awaiting_report").length,
    latest: latest ? { id: latest.id, score: latest.score!, date: latest.date } : null,
    previous,
    changePct,
    open: list.find((r) => r.state === "booked" || r.state === "in_progress" || r.state === "paused") ?? null,
  };
}

/** "Up 20% from 60" and friends, for titles and screen readers. */
export function changeWords(r: Pick<LeadReadiness, "changePct" | "previous">): string {
  if (r.changePct === null || r.previous === null) return "";
  if (r.changePct === 0) return `Same as last time (${r.previous})`;
  return `${r.changePct > 0 ? "Up" : "Down"} ${Math.abs(r.changePct)}% from ${r.previous}`;
}

export const PRACTICE_STATE_LABELS: Record<PracticeState, string> = {
  booked: "Booked",
  in_progress: "In progress",
  paused: "Paused",
  awaiting_report: "Report on its way",
  completed: "Report ready",
  ended: "Ended early",
};

/** Where a practice's main button goes. */
export function practiceHref(r: Pick<LeadPracticeRun, "id" | "state">): string {
  switch (r.state) {
    case "completed":
    case "awaiting_report":
      return `/mock-interviews/report/${r.id}`;
    case "booked":
    case "in_progress":
    case "paused":
      return `/mock-interviews/ai/prepare/${r.id}`;
    default:
      return "/mock-interviews/history";
  }
}

export function newPracticeHref(leadId: string): string {
  return `/mock-interviews/ai/new?lead=${encodeURIComponent(leadId)}`;
}
