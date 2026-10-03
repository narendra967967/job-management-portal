// Mock subscription plans for the admin Plans & Pricing screen (UI-first).
// Replaced by real DB reads once billing is wired.
//
// Model notes:
// - "Free" is a flagged default plan (isFree): assigned on onboarding, excluded
//   from the renewal page, never deletable/deactivatable. It has no pricing — only
//   a duration in days (freeDurationDays; 0 = never expires).
// - Paid plans carry a monthly and a yearly price. A price of 0 DISABLES that
//   interval (e.g. monthly 0 = can't be booked monthly). A paid plan must have at
//   least one interval > 0.
// - `accent` picks the card's header colour. `popular` (Recommended) is controlled
//   from the card and only one plan can hold it.
// - description is rich-text HTML (sanitize server-side when billing is wired).

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

export const MOCK_PLANS: Plan[] = [
  {
    id: "plan_free",
    name: "Free",
    code: "free",
    description: "<p>The default plan every user starts on when they're onboarded.</p>",
    accent: "indigo",
    isFree: true,
    freeDurationDays: 14,
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: "INR",
    limitResumes: 1,
    allowCustomPrompts: false,
    features: ["Up to 20 leads", "Manual Gmail sync", "Community support"],
    popular: false,
    status: "active",
    subscribers: 3,
    everSubscribed: 5,
  },
  {
    id: "plan_starter",
    name: "Starter",
    code: "starter",
    description: "<p>For active job seekers who want <b>automation</b>.</p>",
    accent: "emerald",
    isFree: false,
    freeDurationDays: 0,
    monthlyPrice: 299,
    yearlyPrice: 2499,
    currency: "INR",
    limitResumes: 3,
    allowCustomPrompts: false,
    features: ["Unlimited leads", "300 AI calls / month", "Auto Gmail sync", "Email support"],
    popular: false,
    status: "active",
    subscribers: 4,
    everSubscribed: 9,
  },
  {
    id: "plan_pro",
    name: "Pro",
    code: "pro",
    description: "<p>Everything you need to run outreach at scale.</p>",
    accent: "violet",
    isFree: false,
    freeDurationDays: 0,
    monthlyPrice: 599,
    yearlyPrice: 4999,
    currency: "INR",
    limitResumes: 10,
    allowCustomPrompts: true,
    features: ["Everything in Starter", "1,000 AI calls / month", "Priority email support"],
    popular: true,
    status: "active",
    subscribers: 5,
    everSubscribed: 11,
  },
  {
    id: "plan_business",
    name: "Business",
    code: "business",
    description: "<p>Highest limits and priority support.</p>",
    accent: "rose",
    isFree: false,
    freeDurationDays: 0,
    monthlyPrice: 1299,
    yearlyPrice: 10999,
    currency: "INR",
    limitResumes: null,
    allowCustomPrompts: true,
    features: ["Everything in Pro", "5,000 AI calls / month", "Priority support"],
    popular: false,
    status: "active",
    subscribers: 2,
    everSubscribed: 3,
  },
  {
    id: "plan_beta",
    name: "Beta access",
    code: "beta",
    description: "<p>Internal testing plan — not shown to users yet.</p>",
    accent: "amber",
    isFree: false,
    freeDurationDays: 0,
    monthlyPrice: 0,
    yearlyPrice: 1999,
    currency: "INR",
    limitResumes: null,
    allowCustomPrompts: true,
    features: ["All features unlocked"],
    popular: false,
    status: "inactive",
    subscribers: 0,
    everSubscribed: 0,
  },
];
