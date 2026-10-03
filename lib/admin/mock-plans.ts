// Mock subscription plans for the admin Plans & Pricing screen (UI-first).
// Replaced by real DB reads once billing is wired.

export type PlanStatus = "active" | "inactive";
export type BillingCycle = "monthly" | "quarterly" | "half-yearly" | "yearly";
export type Currency = "INR" | "USD";

// Per-period suffix shown after the price (e.g. "₹499 / month").
export const CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: "month",
  quarterly: "quarter",
  "half-yearly": "6 months",
  yearly: "year",
};

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
  price: number;
  currency: Currency;
  cycle: BillingCycle;
  trialDays: number;
  features: string[];
  /** Highlight on the pricing page ("Recommended"). */
  popular: boolean;
  status: PlanStatus;
  /** Users currently on this plan. */
  subscribers: number;
  /** Users who have EVER been on this plan — gates deletion (>0 → deactivate only). */
  everSubscribed: number;
}

export function formatPrice(plan: Plan): string {
  if (plan.price === 0) return "Free";
  return `${CURRENCY_SYMBOL[plan.currency]}${plan.price.toLocaleString("en-IN")}`;
}

export const MOCK_PLANS: Plan[] = [
  {
    id: "plan_free",
    name: "Free",
    code: "free",
    description: "Get started and capture a handful of leads at no cost.",
    price: 0,
    currency: "INR",
    cycle: "monthly",
    trialDays: 0,
    features: ["Up to 20 leads", "1 résumé", "Manual Gmail sync", "Community support"],
    popular: false,
    status: "active",
    subscribers: 3,
    everSubscribed: 5,
  },
  {
    id: "plan_monthly",
    name: "Monthly",
    code: "monthly",
    description: "Full access billed every month.",
    price: 499,
    currency: "INR",
    cycle: "monthly",
    trialDays: 7,
    features: ["Unlimited leads", "5 résumés", "500 AI calls / month", "Auto Gmail sync", "Email support"],
    popular: false,
    status: "active",
    subscribers: 4,
    everSubscribed: 9,
  },
  {
    id: "plan_quarterly",
    name: "Quarterly",
    code: "quarterly",
    description: "Save vs. monthly, billed every 3 months.",
    price: 1299,
    currency: "INR",
    cycle: "quarterly",
    trialDays: 7,
    features: ["Everything in Monthly", "1,800 AI calls / quarter", "Priority email support"],
    popular: false,
    status: "active",
    subscribers: 2,
    everSubscribed: 4,
  },
  {
    id: "plan_half",
    name: "Half-yearly",
    code: "half-yearly",
    description: "Six months of full access at a better rate.",
    price: 2399,
    currency: "INR",
    cycle: "half-yearly",
    trialDays: 7,
    features: ["Everything in Quarterly", "4,000 AI calls / 6 months"],
    popular: false,
    status: "active",
    subscribers: 2,
    everSubscribed: 3,
  },
  {
    id: "plan_yearly",
    name: "Yearly",
    code: "yearly",
    description: "Best value — two months free vs. monthly.",
    price: 3999,
    currency: "INR",
    cycle: "yearly",
    trialDays: 14,
    features: ["Everything in Half-yearly", "10,000 AI calls / year", "Priority support"],
    popular: true,
    status: "active",
    subscribers: 3,
    everSubscribed: 6,
  },
  {
    id: "plan_beta",
    name: "Beta access",
    code: "beta",
    description: "Internal testing plan — not shown to users yet.",
    price: 0,
    currency: "INR",
    cycle: "monthly",
    trialDays: 0,
    features: ["All features unlocked"],
    popular: false,
    status: "inactive",
    subscribers: 0,
    everSubscribed: 0,
  },
];
