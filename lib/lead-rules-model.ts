// Automatic lead rules: the per-user settings, and the pure decision of what (if
// anything) a rule does to a lead. Client-safe; the daily run is lib/lead-rules.ts.

import { z } from "zod";
import type { CloseOutcome, LeadStatus } from "@/lib/types";

export interface LeadRules {
  neverTouched: { on: boolean; days: number };
  forgotten: { on: boolean; days: number };
  lowFit: { on: boolean; score: number; days: number };
  appliedQuiet: { on: boolean; days: number };
  followUpsDone: { on: boolean; days: number };
  strongFit: { on: boolean; score: number };
}

export const DEFAULT_LEAD_RULES: LeadRules = {
  neverTouched: { on: true, days: 30 },
  forgotten: { on: true, days: 45 },
  lowFit: { on: true, score: 40, days: 7 },
  appliedQuiet: { on: true, days: 45 },
  followUpsDone: { on: true, days: 14 },
  strongFit: { on: true, score: 80 },
};

const zDays = z.coerce.number().int().min(1).max(365);
const zScore = z.coerce.number().int().min(1).max(100);

export const leadRulesSchema = z.object({
  neverTouched: z.object({ on: z.boolean(), days: zDays }),
  forgotten: z.object({ on: z.boolean(), days: zDays }),
  lowFit: z.object({ on: z.boolean(), score: zScore, days: zDays }),
  appliedQuiet: z.object({ on: z.boolean(), days: zDays }),
  followUpsDone: z.object({ on: z.boolean(), days: zDays }),
  strongFit: z.object({ on: z.boolean(), score: zScore }),
});

/** Stored rules over the defaults, so an empty column means everything on. */
export function normalizeLeadRules(raw: unknown): LeadRules {
  const stored = (raw && typeof raw === "object" ? raw : {}) as Partial<LeadRules>;
  const merged = {} as Record<keyof LeadRules, unknown>;
  for (const key of Object.keys(DEFAULT_LEAD_RULES) as (keyof LeadRules)[]) {
    merged[key] = { ...DEFAULT_LEAD_RULES[key], ...stored[key] };
  }
  const parsed = leadRulesSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_LEAD_RULES;
}

/** What moved a lead: a daily rule, the user's own action, or a repeat alert. */
export type AutoActionRule = keyof LeadRules | "activity" | "job-came-back";

/** Auto-closed by one of these, a repeat alert means the role is still open. */
export const REOPENABLE_RULES: AutoActionRule[] = [
  "neverTouched",
  "forgotten",
  "appliedQuiet",
  "followUpsDone",
];

export interface RuleDecision {
  rule: keyof LeadRules;
  toStatus: LeadStatus;
  closeOutcome: CloseOutcome | null;
  reason: string;
}

export interface RuleLeadFacts {
  status: LeadStatus;
  /** Latest thing that happened on the lead, by the user or a new alert (ms). */
  lastActiveMs: number;
  /** Score against the user's default resume, if one was calculated. */
  score: number | null;
  scoredMs: number | null;
  /** A follow-up was sent or marked unanswered, and no reply was recorded. */
  followUpsUnanswered: boolean;
  /** Rules the user undid on this lead; those never touch it again. */
  undoneRules: ReadonlySet<string>;
}

const DAY_MS = 86_400_000;

/**
 * The first rule that applies to a lead, most specific first. The caller has
 * already left out what rules never touch: Top Choice, pinned, a pending reminder
 * or an open task, and every stage past Applied.
 */
export function decideLeadRule(
  lead: RuleLeadFacts,
  rules: LeadRules,
  nowMs: number,
): RuleDecision | null {
  const quietFor = (days: number) => nowMs - lead.lastActiveMs >= days * DAY_MS;
  const usable = (rule: keyof LeadRules) => rules[rule].on && !lead.undoneRules.has(rule);
  const early = lead.status === "new" || lead.status === "shortlisted";

  if (
    usable("lowFit") &&
    early &&
    lead.score !== null &&
    lead.scoredMs !== null &&
    lead.score < rules.lowFit.score &&
    nowMs - lead.scoredMs >= rules.lowFit.days * DAY_MS &&
    quietFor(rules.lowFit.days)
  ) {
    return {
      rule: "lowFit",
      toStatus: "discarded",
      closeOutcome: null,
      reason: `Discarded automatically: your resume scored ${lead.score} for this job, below your limit of ${rules.lowFit.score}.`,
    };
  }
  if (usable("followUpsDone") && lead.followUpsUnanswered && quietFor(rules.followUpsDone.days)) {
    return {
      rule: "followUpsDone",
      toStatus: "closed",
      closeOutcome: "no-response",
      reason: `Closed automatically: your follow-ups have gone unanswered for ${rules.followUpsDone.days} days.`,
    };
  }
  if (usable("appliedQuiet") && lead.status === "applied" && quietFor(rules.appliedQuiet.days)) {
    return {
      rule: "appliedQuiet",
      toStatus: "closed",
      closeOutcome: "no-response",
      reason: `Closed automatically: you applied, and nothing has happened on this job for ${rules.appliedQuiet.days} days.`,
    };
  }
  if (usable("neverTouched") && lead.status === "new" && quietFor(rules.neverTouched.days)) {
    return {
      rule: "neverTouched",
      toStatus: "closed",
      closeOutcome: "position-closed",
      reason: `Closed automatically: no activity for ${rules.neverTouched.days} days, so the role has likely been filled.`,
    };
  }
  if (usable("forgotten") && lead.status === "shortlisted" && quietFor(rules.forgotten.days)) {
    return {
      rule: "forgotten",
      toStatus: "closed",
      closeOutcome: "position-closed",
      reason: `Closed automatically: shortlisted with no activity for ${rules.forgotten.days} days, so the role has likely been filled.`,
    };
  }
  if (usable("strongFit") && lead.status === "new" && lead.score !== null && lead.score >= rules.strongFit.score) {
    return {
      rule: "strongFit",
      toStatus: "shortlisted",
      closeOutcome: null,
      reason: `Moved to Shortlisted automatically: your resume scored ${lead.score} for this job.`,
    };
  }
  return null;
}
