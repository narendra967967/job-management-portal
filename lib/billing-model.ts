// Billing — shared types and the price/term maths for plan purchases.
// Pure and client-safe: the checkout summary shows exactly what the server will
// charge, because both call quote(). Spec: memory payments-plan.
//
// Prices on plans are whole currency units (₹499); everything charged is in
// paise (the smallest unit Razorpay takes). GST follows admin Billing:
// "prices include tax" → the plan price is the total, else GST is added.

import type { PublicPlan } from "@/lib/pricing";

export type BillingPeriod = "monthly" | "yearly";

export const PERIOD_LABELS: Record<BillingPeriod, string> = { monthly: "Monthly", yearly: "Yearly" };

/** A plan a user can buy (the public plan fields + its id). */
export type OfferPlan = PublicPlan;

export interface TaxSettings {
  /** Percent, e.g. 18. */
  taxRate: number;
  pricesIncludeTax: boolean;
}

/** The user's plan as checkout needs it. */
export interface CurrentPlanInfo {
  planId: string | null;
  name: string;
  isFree: boolean;
  monthlyPrice: number;
  yearlyPrice: number;
  /** ISO, or null when the plan never expires. */
  expiresAt: string | null;
  /** The period of the last paid term, when known (credit maths). */
  lastPeriod: BillingPeriod | null;
}

/** Days a period is worth when converting unused time into credit. */
const VALUE_DAYS: Record<BillingPeriod, number> = { monthly: 30, yearly: 365 };
const DAY_MS = 86_400_000;

export function priceFor(plan: Pick<OfferPlan, "monthlyPrice" | "yearlyPrice">, period: BillingPeriod): number {
  return period === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
}

/** Periods this plan can be bought for (a 0 price disables that period). */
export function periodsFor(plan: Pick<OfferPlan, "monthlyPrice" | "yearlyPrice">): BillingPeriod[] {
  return (["monthly", "yearly"] as const).filter((p) => priceFor(plan, p) > 0);
}

/** One calendar month or year after `from`. */
export function addPeriod(from: Date, period: BillingPeriod): Date {
  const d = new Date(from);
  if (period === "monthly") d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
}

/** Split a whole-unit price into base + GST + total, in paise. */
export function taxSplit(price: number, tax: TaxSettings): { base: number; tax: number; total: number } {
  const units = Math.round(price * 100);
  if (tax.taxRate <= 0) return { base: units, tax: 0, total: units };
  if (tax.pricesIncludeTax) {
    const base = Math.round((units * 100) / (100 + tax.taxRate));
    return { base, tax: units - base, total: units };
  }
  const gst = Math.round((units * tax.taxRate) / 100);
  return { base: units, tax: gst, total: units + gst };
}

export type QuoteKind = "renew" | "upgrade" | "new";

export interface Quote {
  planId: string;
  planName: string;
  period: BillingPeriod;
  kind: QuoteKind;
  currency: string;
  /** Paise. */
  base: number;
  tax: number;
  total: number;
  taxRate: number;
  pricesIncludeTax: boolean;
  /** Extra days from the unused value of the current paid plan (upgrades). */
  creditDays: number;
  /** ISO dates of the new term. */
  startsAt: string;
  expiresAt: string;
}

/**
 * What buying `plan` for `period` costs and the access it gives:
 * - renew (same plan): the new term starts when the current one ends, so time
 *   stacks;
 * - upgrade (another plan while a paid one is running): starts now, and the
 *   unused value of the current plan becomes extra days on the new one, pro rata
 *   on price (free-trial days carry no value);
 * - new (expired, or coming from free): starts now.
 */
export function quote(args: {
  plan: OfferPlan;
  period: BillingPeriod;
  current: CurrentPlanInfo | null;
  tax: TaxSettings;
  now?: Date;
}): Quote {
  const { plan, period, current, tax } = args;
  const now = args.now ?? new Date();
  const curExpiry = current?.expiresAt ? new Date(current.expiresAt) : null;
  const running = !!curExpiry && curExpiry.getTime() > now.getTime();

  let kind: QuoteKind = "new";
  if (current?.planId === plan.id && running) kind = "renew";
  else if (running && current && !current.isFree) kind = "upgrade";

  let startsAt = now;
  let creditDays = 0;
  if (kind === "renew" && curExpiry) startsAt = curExpiry;
  if (kind === "upgrade" && current && curExpiry) {
    const curPeriod: BillingPeriod =
      current.lastPeriod ?? (current.monthlyPrice > 0 ? "monthly" : "yearly");
    const curDaily = priceFor(current, curPeriod) / VALUE_DAYS[curPeriod];
    const newDaily = priceFor(plan, period) / VALUE_DAYS[period];
    const remainingDays = (curExpiry.getTime() - now.getTime()) / DAY_MS;
    if (curDaily > 0 && newDaily > 0) creditDays = Math.floor((remainingDays * curDaily) / newDaily);
  }

  const end = addPeriod(startsAt, period);
  end.setTime(end.getTime() + creditDays * DAY_MS);
  const split = taxSplit(priceFor(plan, period), tax);

  return {
    planId: plan.id,
    planName: plan.name,
    period,
    kind,
    currency: plan.currency,
    ...split,
    taxRate: tax.taxRate,
    pricesIncludeTax: tax.pricesIncludeTax,
    creditDays,
    startsAt: startsAt.toISOString(),
    expiresAt: end.toISOString(),
  };
}

/** "₹1,180.00" from paise. */
export function formatPaise(paise: number, currency: string): string {
  const sym = currency === "USD" ? "$" : "₹";
  return `${sym}${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "₹499" from whole units. */
export function formatPrice(units: number, currency: string): string {
  const sym = currency === "USD" ? "$" : "₹";
  return `${sym}${units.toLocaleString("en-IN")}`;
}

/** Order states (payment_orders.status). */
export type OrderStatus = "created" | "paid" | "failed" | "cancelled";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  created: "Pending",
  paid: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** A row in admin Orders & Payments. */
export interface AdminOrderRow {
  id: string;
  createdAt: string;
  paidAt: string | null;
  user: { name: string; email: string } | null;
  planName: string;
  period: BillingPeriod;
  kind: QuoteKind;
  /** Paise: price before GST, GST, and what was charged. */
  base: number;
  tax: number;
  total: number;
  taxRate: number;
  currency: string;
  /** The term this order buys (ISO); applied once paid. */
  startsAt: string;
  expiresAt: string;
  /** Extra days credited for the unused value of the previous plan. */
  creditDays: number;
  gateway: string;
  mode: "test" | "live";
  status: OrderStatus;
  /** How the user paid (from the gateway): UPI, Card, Netbanking, Wallet… */
  method: string | null;
  /** Our receipt number (billing invoice prefix + sequence). */
  receipt: string;
  gatewayOrderId: string | null;
  gatewayPaymentId: string | null;
  failureReason: string | null;
}

/** Payment gateways the app knows; more are added as modules. */
export type GatewayId = "razorpay";

export const GATEWAY_LABELS: Record<GatewayId, string> = { razorpay: "Razorpay" };

/** Admin view of one gateway (secrets never leave the server; only "is set"). */
export interface GatewaySettings {
  id: GatewayId;
  enabled: boolean;
  mode: "test" | "live";
  keyId: string;
  hasKeySecret: boolean;
  hasWebhookSecret: boolean;
  /** Last "Test connection" result. */
  lastTestOk: boolean | null;
  lastTestAt: string | null;
}
