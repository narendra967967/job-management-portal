// Shared plan model for the admin Plans & Pricing screen (UI type + helpers).
// Real data comes from the `plans` table via lib/admin/plans-data.
//
// Model notes:
// - "Free" is a flagged default plan (isFree): assigned on onboarding, excluded
//   from the renewal page, and the ACTIVE free plan is never deletable/deactivatable.
//   It has no pricing — only a duration in days (freeDurationDays; 0 = never expires).
// - Paid plans carry a monthly and a yearly price. A price of 0 DISABLES that
//   interval. A paid plan must have at least one interval > 0.
// - `accent` picks the card's header colour. `popular` (Recommended) is single-winner.
// - description is rich-text HTML.

export type PlanStatus = "active" | "inactive";
export type Currency = "INR" | "USD";

export const CURRENCY_SYMBOL: Record<Currency, string> = { INR: "₹", USD: "$" };

// Header-colour options. Classes are literal so Tailwind includes them. White text
// stays readable on the -600→-700 gradients.
export const ACCENTS = {
  indigo: { label: "Indigo", grad: "from-indigo-600 to-indigo-700", ring: "ring-indigo-400", check: "text-indigo-500" },
  violet: { label: "Violet", grad: "from-violet-600 to-violet-700", ring: "ring-violet-400", check: "text-violet-500" },
  blue: { label: "Blue", grad: "from-blue-600 to-blue-700", ring: "ring-blue-400", check: "text-blue-500" },
  teal: { label: "Teal", grad: "from-teal-600 to-teal-700", ring: "ring-teal-400", check: "text-teal-500" },
  emerald: { label: "Emerald", grad: "from-emerald-600 to-emerald-700", ring: "ring-emerald-400", check: "text-emerald-500" },
  amber: { label: "Amber", grad: "from-amber-600 to-amber-700", ring: "ring-amber-400", check: "text-amber-500" },
  rose: { label: "Rose", grad: "from-rose-600 to-rose-700", ring: "ring-rose-400", check: "text-rose-500" },
  fuchsia: { label: "Fuchsia", grad: "from-fuchsia-600 to-fuchsia-700", ring: "ring-fuchsia-400", check: "text-fuchsia-500" },
} as const;
export type AccentKey = keyof typeof ACCENTS;
export const ACCENT_KEYS = Object.keys(ACCENTS) as AccentKey[];

export interface Plan {
  id: string;
  name: string;
  /** Slug, auto-derived from name; locked once the plan exists. */
  code: string;
  /** Rich-text HTML. */
  description: string;
  accent: AccentKey;
  isFree: boolean;
  /** Free plan only — days of access before renewal (0 = never expires). */
  freeDurationDays: number;
  /** 0 disables this interval. */
  monthlyPrice: number;
  yearlyPrice: number;
  currency: Currency;
  /** null = unlimited. */
  limitResumes: number | null;
  /** May users override AI prompts on this plan? */
  allowCustomPrompts: boolean;
  features: string[];
  /** Recommended highlight — at most one plan. */
  popular: boolean;
  status: PlanStatus;
  subscribers: number;
  everSubscribed: number;
}

export function formatMoney(amount: number, currency: Currency): string {
  return `${CURRENCY_SYMBOL[currency]}${amount.toLocaleString("en-IN")}`;
}

/** Yearly discount vs. 12× monthly, or null if either interval is disabled. */
export function yearlySavingsPct(plan: Plan): number | null {
  if (plan.monthlyPrice <= 0 || plan.yearlyPrice <= 0) return null;
  const pct = Math.round((1 - plan.yearlyPrice / (plan.monthlyPrice * 12)) * 100);
  return pct > 0 ? pct : null;
}
