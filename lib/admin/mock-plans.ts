// Mock subscription plans for the admin Plans & Pricing screen (UI-first).
// Replaced by real DB reads once billing is wired.
//
// Model: "Free" is its own plan, flagged `isFree` — the default assigned when a
// user is onboarded, excluded from the renewal page, and never deletable/
// deactivatable. Every paid plan carries BOTH a monthly and a yearly price
// (those are the only intervals; no free-trial field).

export type PlanStatus = "active" | "inactive";
export type Currency = "INR" | "USD";

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  INR: "₹",
  USD: "$",
};

export interface Plan {
  id: string;
  name: string;
  /** Internal key, stable across edits (used to map subscriptions to a plan). */
  code: string;
  description: string;
  /** The default/onboarding plan. Exactly one; no pricing; can't be deleted/deactivated. */
  isFree: boolean;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: Currency;
  features: string[];
  /** Highlight on the pricing page ("Recommended"). */
  popular: boolean;
  status: PlanStatus;
  /** Users currently on this plan. */
  subscribers: number;
  /** Users who have EVER been on this plan — gates deletion (>0 → deactivate only). */
  everSubscribed: number;
}

export function formatMoney(amount: number, currency: Currency): string {
  return `${CURRENCY_SYMBOL[currency]}${amount.toLocaleString("en-IN")}`;
}

/** Yearly discount vs. paying monthly for a year, or null if not applicable. */
export function yearlySavingsPct(plan: Plan): number | null {
  if (plan.monthlyPrice <= 0 || plan.yearlyPrice <= 0) return null;
  const full = plan.monthlyPrice * 12;
  const pct = Math.round((1 - plan.yearlyPrice / full) * 100);
  return pct > 0 ? pct : null;
}

export const MOCK_PLANS: Plan[] = [
  {
    id: "plan_free",
    name: "Free",
    code: "free",
    description: "The default plan every user starts on when they're onboarded.",
    isFree: true,
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: "INR",
    features: ["Up to 20 leads", "1 résumé", "Manual Gmail sync", "Community support"],
    popular: false,
    status: "active",
    subscribers: 3,
    everSubscribed: 5,
  },
  {
    id: "plan_starter",
    name: "Starter",
    code: "starter",
    description: "For active job seekers who want automation.",
    isFree: false,
    monthlyPrice: 299,
    yearlyPrice: 2499,
    currency: "INR",
    features: ["Unlimited leads", "3 résumés", "300 AI calls / month", "Auto Gmail sync", "Email support"],
    popular: false,
    status: "active",
    subscribers: 4,
    everSubscribed: 9,
  },
  {
    id: "plan_pro",
    name: "Pro",
    code: "pro",
    description: "Everything you need to run outreach at scale.",
    isFree: false,
    monthlyPrice: 599,
    yearlyPrice: 4999,
    currency: "INR",
    features: ["Everything in Starter", "10 résumés", "1,000 AI calls / month", "Priority email support"],
    popular: true,
    status: "active",
    subscribers: 5,
    everSubscribed: 11,
  },
  {
    id: "plan_business",
    name: "Business",
    code: "business",
    description: "Highest limits and priority support.",
    isFree: false,
    monthlyPrice: 1299,
    yearlyPrice: 10999,
    currency: "INR",
    features: ["Everything in Pro", "Unlimited résumés", "5,000 AI calls / month", "Priority support"],
    popular: false,
    status: "active",
    subscribers: 2,
    everSubscribed: 3,
  },
  {
    id: "plan_beta",
    name: "Beta access",
    code: "beta",
    description: "Internal testing plan — not shown to users yet.",
    isFree: false,
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: "INR",
    features: ["All features unlocked"],
    popular: false,
    status: "inactive",
    subscribers: 0,
    everSubscribed: 0,
  },
];
