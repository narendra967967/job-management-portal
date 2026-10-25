// What each plan includes, worded from its stored limits and switches (never
// hand-typed), so the pricing cards, the homepage FAQ and llms.txt always match
// what lib/entitlements.ts enforces. Pure functions: safe on server and client.

import type { PublicPlan } from "@/lib/pricing";

type Caps = Pick<
  PublicPlan,
  | "name"
  | "limitActiveLeads"
  | "limitResumes"
  | "limitAiAddMonthly"
  | "allowAiDrafts"
  | "allowAiEmailReading"
  | "allowNotes"
  | "allowSalaryInsight"
  | "allowAtsCheck"
  | "allowCustomPrompts"
  | "prioritySupport"
>;

interface Capability {
  /** Bullet text, or null when the plan doesn't include it. */
  bullet: (p: Caps) => string | null;
  /** -1 / 0 / 1: is `a` worse, equal or better than `b` on this capability? */
  compare: (a: Caps, b: Caps) => number;
}

const n = (v: number) => v.toLocaleString("en-IN");
/** null = unlimited, which beats any number. */
const cmpLimit = (a: number | null, b: number | null) =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : Math.sign(a - b);
const cmpFlag = (a: boolean, b: boolean) => Number(a) - Number(b);

function limit(get: (p: Caps) => number | null, unlimited: string, some: (v: number) => string): Capability {
  return {
    bullet: (p) => {
      const v = get(p);
      return v === null ? unlimited : v > 0 ? some(v) : null;
    },
    compare: (a, b) => cmpLimit(get(a), get(b)),
  };
}

function flag(get: (p: Caps) => boolean, text: string): Capability {
  return { bullet: (p) => (get(p) ? text : null), compare: (a, b) => cmpFlag(get(a), get(b)) };
}

// Display order on the cards.
const CAPABILITIES: Capability[] = [
  limit((p) => p.limitActiveLeads, "Unlimited active leads", (v) => `Up to ${n(v)} active leads`),
  limit((p) => p.limitResumes, "Unlimited résumés", (v) => (v === 1 ? "1 résumé" : `Up to ${n(v)} résumés`)),
  limit((p) => p.limitAiAddMonthly, "Unlimited Add with AI", (v) => `${n(v)} Add with AI uses a month`),
  flag((p) => p.allowAiDrafts, "AI outreach drafts"),
  flag((p) => p.allowAiEmailReading, "AI reading of alerts from more job sites"),
  flag((p) => p.allowNotes, "Personal notes"),
  flag((p) => p.allowSalaryInsight, "Salary insight for every job"),
  flag((p) => p.allowAtsCheck, "Résumé ATS check"),
  flag((p) => p.allowCustomPrompts, "Custom AI prompts"),
  flag((p) => p.prioritySupport, "Priority support"),
];

export interface PlanHighlights {
  /** "Everything in Premium, plus:" when this plan includes all of the previous one. */
  intro: string | null;
  items: string[];
}

/** Card bullets. With the previous (cheaper) plan, a plan that includes all of it
 *  lists only what it adds; otherwise every capability is listed. */
export function planHighlights(plan: Caps, prev?: Caps): PlanHighlights {
  const coversPrev = !!prev && CAPABILITIES.every((c) => c.compare(plan, prev) >= 0);
  const items = CAPABILITIES.filter((c) => !coversPrev || c.compare(plan, prev!) > 0)
    .map((c) => c.bullet(plan))
    .filter((b): b is string => !!b);
  return { intro: coversPrev ? `Everything in ${prev!.name}, plus:` : null, items };
}

/** Mid-sentence form: "Unlimited résumés" → "unlimited résumés"; keeps "AI …". */
const lower = (s: string) => (/^[A-Z][a-zé]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

function andList(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

/** "Premium adds unlimited active leads, … Pro adds …" for paid plans, or "". */
export function upgradeSentence(plans: Caps[], maxPerPlan = 4): string {
  const parts: string[] = [];
  plans.forEach((p, i) => {
    if (i === 0) return; // the entry plan
    const { intro, items } = planHighlights(p, plans[i - 1]);
    if (items.length === 0) return;
    const shown = items.slice(0, maxPerPlan).map(lower);
    const more = items.length > maxPerPlan;
    const list = more ? `${shown.join(", ")} and more` : andList(shown);
    parts.push(intro ? `${p.name} adds ${list}` : `${p.name} includes ${list}`);
  });
  return parts.map((s) => `${s}.`).join(" ");
}

/** "Premium or Pro". */
export function orList(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`;
}
