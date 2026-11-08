// Billing — shared types and the price/term maths for plan purchases.
// Pure and client-safe: the checkout summary shows exactly what the server will
// charge, because both call quote(). Spec: memory payments-plan.
//
// Prices on plans are whole currency units (₹499); everything charged is in
// paise (the smallest unit Razorpay takes). Tax follows admin Billing:
// GST registered = No → no GST at all; Yes → GST at the set rate, either on
// top of the plan price or already inside it ("prices include tax"). Until
// Billing is complete, online payment stays off (memory invoice-requirements).

import type { PublicPlan } from "@/lib/pricing";

export type BillingPeriod = "monthly" | "yearly";

export const PERIOD_LABELS: Record<BillingPeriod, string> = { monthly: "Monthly", yearly: "Yearly" };

/** A plan a user can buy (the public plan fields + its id). */
export type OfferPlan = PublicPlan;

export interface TaxSettings {
  /** Billing "GST registered". Only a registered seller charges GST. */
  gstRegistered: boolean;
  /** Percent, e.g. 18. */
  taxRate: number;
  pricesIncludeTax: boolean;
}

/** The GST rate actually charged (0 when not registered). */
export function effectiveTaxRate(tax: TaxSettings): number {
  return tax.gstRegistered ? tax.taxRate : 0;
}

/** Admin Settings → Billing: the seller and tax details. gstRegistered null =
 *  not chosen yet. */
export interface BillingProfile {
  gstRegistered: boolean | null;
  companyName: string;
  companyAddress: string;
  /** Not registered: the seller's PAN. */
  pan: string;
  /** Registered: GSTIN, rate, prices-include-tax and SAC code. */
  gstin: string;
  taxRate: number;
  pricesIncludeTax: boolean;
  sacCode: string;
  invoicePrefix: string;
}

const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** A GSTIN: 2-digit state code, PAN, entity number, "Z", and a check character
 *  (official mod-36 checksum), e.g. 27AAPFU0939F1ZV. */
export function isValidGstin(raw: string): boolean {
  const g = raw.trim().toUpperCase();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const p = GSTIN_CHARS.indexOf(g[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36] === g[14];
}

/** A PAN: five letters, four digits, one letter (e.g. ABCDE1234F). */
export function isValidPan(raw: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(raw.trim().toUpperCase());
}

/** A services SAC code: six digits starting 99. */
export function isValidSac(raw: string): boolean {
  return /^99[0-9]{4}$/.test(raw.trim());
}

/** What Billing still needs before online payment can run (empty = ready). */
export function billingMissing(b: BillingProfile): string[] {
  if (b.gstRegistered === null) return ["whether you're GST registered"];
  const out: string[] = [];
  if (!b.companyName.trim()) out.push("the business name");
  if (!b.companyAddress.trim()) out.push("the business address");
  if (b.gstRegistered) {
    if (!isValidGstin(b.gstin)) out.push(b.gstin.trim() ? "a valid GSTIN" : "the GSTIN");
    if (!(b.taxRate > 0 && b.taxRate <= 100)) out.push("a GST rate above 0");
    if (!isValidSac(b.sacCode)) out.push(b.sacCode.trim() ? "a valid SAC code" : "the SAC code");
  } else if (!isValidPan(b.pan)) {
    out.push(b.pan.trim() ? "a valid PAN" : "the PAN");
  }
  if (!b.invoicePrefix.trim()) out.push("the invoice number prefix");
  return out;
}

export function billingReady(b: BillingProfile): boolean {
  return billingMissing(b).length === 0;
}

/** The seller and tax details copied onto a payment when it's made, so later
 *  Billing changes never alter an existing payment or its invoice. */
export interface BillingSnapshot {
  gstRegistered: boolean;
  companyName: string;
  companyAddress: string;
  pan: string | null;
  gstin: string | null;
  sacCode: string | null;
  taxRate: number;
  pricesIncludeTax: boolean;
  invoicePrefix: string;
}

export function billingSnapshot(b: BillingProfile): BillingSnapshot {
  const reg = !!b.gstRegistered;
  return {
    gstRegistered: reg,
    companyName: b.companyName.trim(),
    companyAddress: b.companyAddress.trim(),
    pan: reg ? null : b.pan.trim().toUpperCase(),
    gstin: reg ? b.gstin.trim().toUpperCase() : null,
    sacCode: reg ? b.sacCode.trim() : null,
    taxRate: reg ? b.taxRate : 0,
    pricesIncludeTax: reg && b.pricesIncludeTax,
    invoicePrefix: b.invoicePrefix.trim(),
  };
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

/** Split a whole-unit price into base + GST + total, in paise. With GST off
 *  the plan price is simply the total. */
export function taxSplit(price: number, tax: TaxSettings): { base: number; tax: number; total: number } {
  const units = Math.round(price * 100);
  const rate = effectiveTaxRate(tax);
  if (rate <= 0) return { base: units, tax: 0, total: units };
  if (tax.pricesIncludeTax) {
    const base = Math.round((units * 100) / (100 + rate));
    return { base, tax: units - base, total: units };
  }
  const gst = Math.round((units * rate) / 100);
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
    taxRate: effectiveTaxRate(tax),
    pricesIncludeTax: tax.gstRegistered && tax.pricesIncludeTax,
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
