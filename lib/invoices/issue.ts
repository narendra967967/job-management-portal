import "server-only";

// Issuing invoices (docs/invoices/spec.md I1, I3, sections 3, 4, 12). One per
// paid order, built from what the order froze when it was created (seller,
// buyer, amounts, tax split) plus what's printed as of the payment (terms,
// logo), then stored whole in invoices.doc and never changed.
//
// ensureInvoice is safe to call any number of times, from anywhere: right
// after a payment is confirmed, from the startup catch-up, or on download.
// Issuing never sits inside the payment's own transaction, so a problem with
// an invoice can never undo a payment; the catch-up issues it later instead.

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { billingConfig, invoiceCounters, invoices, paymentOrders } from "@/db/schema";
import { GATEWAY_LABELS, PERIOD_LABELS, type BillingSnapshot } from "@/lib/billing-model";
import { getAppName, getSupportEmail } from "@/lib/branding";
import { stateByCode } from "@/lib/india-states";
import type { BillingDetails } from "@/lib/invoices/billing-details";
import { logoForInvoice } from "@/lib/invoices/logo";
import {
  DEFAULT_INVOICE_TERMS,
  INVOICE_PREFIX_MAX,
  INVOICE_TEMPLATE_VERSION,
  defaultDeclarations,
  financialYear,
  formatInvoiceNumber,
  invoicePrefixError,
  type InvoiceDoc,
} from "@/lib/invoices/model";
import { splitTax } from "@/lib/invoices/tax";
import { siteUrl } from "@/lib/site-url";

type Order = typeof paymentOrders.$inferSelect;

/** Test-mode payments (no real money) never use the real series. */
export const TEST_INVOICE_PREFIX = "TEST/";

/** The order's prefix as frozen on it; a prefix saved before the 5-character rule is trimmed to fit. */
function prefixFor(order: Order, snap: BillingSnapshot | null): string {
  if (order.mode !== "live") return TEST_INVOICE_PREFIX;
  const raw = (snap?.invoicePrefix || order.receiptPrefix || "INV/").trim();
  if (!invoicePrefixError(raw)) return raw;
  return raw.replace(/[^A-Za-z0-9/-]/g, "").slice(0, INVOICE_PREFIX_MAX) || "INV/";
}

const longDate = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Kolkata" });
const methodLabel = (m: string | null) => (!m ? null : m.toLowerCase() === "upi" ? "UPI" : m[0].toUpperCase() + m.slice(1));

/** Everything printed on the order's invoice, as of now. Pure apart from the inputs passed in. */
export function buildInvoiceDoc(
  o: Order,
  ctx: {
    number: string;
    appName: string;
    supportEmail: string;
    website: string;
    logo: string | null;
    terms: { plan: string[]; ai_interview: string[] } | null;
    currentBusinessState: string | null;
  },
): InvoiceDoc {
  const snap = (o.billingSnapshot as BillingSnapshot | null) ?? null;
  const registered = !!snap?.gstRegistered;
  const sellerStateCode = snap?.businessState || ctx.currentBusinessState;
  const sellerState = stateByCode(sellerStateCode);
  const buyerSnap = (o.buyerSnapshot as BillingDetails | null) ?? null;
  const buyerState = stateByCode(buyerSnap?.stateCode);
  const paidAt = o.paidAt ?? o.createdAt;

  // The split stored on the order; older orders with GST but no split are
  // treated as the seller's own state (no buyer state on record).
  let { cgstAmount: cgst, sgstAmount: sgst, igstAmount: igst } = o;
  let placeCode = o.placeOfSupply;
  if (registered && o.taxAmount > 0 && cgst + sgst + igst === 0) {
    const s = splitTax(o.taxAmount, { registered, sellerState: sellerStateCode ?? null, buyerState: null });
    ({ cgst, sgst, igst } = s);
    placeCode = s.placeOfSupply;
  }
  const place = stateByCode(placeCode);

  const isPlan = o.kind !== "ai_interview";
  const lineDescription = isPlan ? `${o.planName} plan, ${o.period ? PERIOD_LABELS[o.period].toLowerCase() : ""}`.replace(/, $/, "") : o.planName;
  const lineDetail = isPlan
    ? o.termStartsAt && o.termEndsAt
      ? `${longDate(o.termStartsAt)} to ${longDate(o.termEndsAt)}`
      : null
    : o.termEndsAt
      ? `Start it by ${longDate(o.termEndsAt)}`
      : null;
  const sellerName = snap?.companyName || ctx.appName;
  const declarations = defaultDeclarations(registered, sellerName);
  if (o.mode !== "live") declarations.unshift("Test payment: made in test mode, so no money was taken.");

  return {
    templateVersion: INVOICE_TEMPLATE_VERSION,
    number: ctx.number,
    issuedAt: paidAt.toISOString(),
    currency: "INR",
    appName: ctx.appName,
    logo: ctx.logo,
    seller: {
      name: sellerName,
      addressLines: (snap?.companyAddress ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
      state: sellerState ? { name: sellerState.name, code: sellerState.code } : null,
      pan: snap?.pan ?? null,
      gstin: snap?.gstin ?? null,
      email: ctx.supportEmail,
      website: ctx.website,
    },
    buyer: buyerSnap
      ? {
          name: buyerSnap.fullName,
          businessName: buyerSnap.businessName || null,
          addressLines: [buyerSnap.addressLine, buyerSnap.city].filter(Boolean),
          state: buyerState ? { name: buyerState.name, code: buyerState.code } : { name: "", code: "" },
          pin: buyerSnap.pin,
          email: o.userEmail,
          mobile: buyerSnap.mobile,
          gstin: buyerSnap.gstin || null,
          pan: buyerSnap.pan || null,
        }
      : {
          // Orders from before billing details were asked for.
          name: o.userName || o.userEmail,
          businessName: null,
          addressLines: [],
          state: { name: "", code: "" },
          pin: "",
          email: o.userEmail,
          mobile: "",
          gstin: null,
          pan: null,
        },
    gst: {
      registered,
      rate: registered ? o.taxRate : 0,
      placeOfSupply: registered && place ? { name: place.name, code: place.code } : null,
      split: !registered ? null : igst > 0 ? "inter" : "intra",
      utgst: registered && igst === 0 && !!sellerState?.utgst,
    },
    lines: [{ description: lineDescription, detail: lineDetail, sac: registered ? (snap?.sacCode ?? null) : null, quantity: 1, taxable: o.baseAmount }],
    totals: { taxable: o.baseAmount, cgst, sgst, igst, total: o.totalAmount },
    payment: {
      paidAt: paidAt.toISOString(),
      method: methodLabel(o.method),
      paymentId: o.gatewayPaymentId ?? "",
      orderNumber: String(o.number),
      gateway: GATEWAY_LABELS[o.gateway as keyof typeof GATEWAY_LABELS] ?? o.gateway,
    },
    terms: isPlan ? (ctx.terms?.plan ?? DEFAULT_INVOICE_TERMS) : (ctx.terms?.ai_interview ?? []),
    links: { terms: `${ctx.website}/terms`, privacy: `${ctx.website}/privacy`, refunds: `${ctx.website}/refunds` },
    declarations,
  };
}

export interface IssuedInvoice {
  id: string;
  number: string;
}

/**
 * The invoice for a paid order, issuing it if it doesn't exist yet. Returns
 * null for an order that isn't paid. The number is taken from the series'
 * counter in the same transaction as the insert, so a failed insert leaves no
 * gap, and two calls at once can't issue two invoices (unique order).
 */
export async function ensureInvoice(orderId: string): Promise<IssuedInvoice | null> {
  const existing = async () => (await db.select({ id: invoices.id, number: invoices.number }).from(invoices).where(eq(invoices.orderId, orderId)).limit(1))[0] ?? null;
  const found = await existing();
  if (found) return found;

  const [o] = await db.select().from(paymentOrders).where(eq(paymentOrders.id, orderId)).limit(1);
  if (!o || o.status !== "paid" || !o.paidAt) return null;

  const [appName, supportEmail, logo, [billing]] = await Promise.all([
    getAppName(),
    getSupportEmail(),
    logoForInvoice(),
    db.select({ terms: billingConfig.invoiceTerms, state: billingConfig.businessState }).from(billingConfig).limit(1),
  ]);
  const snap = (o.billingSnapshot as BillingSnapshot | null) ?? null;
  const prefix = prefixFor(o, snap);
  const fy = financialYear(o.paidAt);
  const series = `${o.mode === "live" ? "live" : "test"}|${prefix}|${fy}`;

  try {
    return await db.transaction(async (tx) => {
      const [c] = await tx
        .insert(invoiceCounters)
        .values({ series, lastSeq: 1 })
        .onConflictDoUpdate({ target: invoiceCounters.series, set: { lastSeq: sql`${invoiceCounters.lastSeq} + 1` } })
        .returning({ seq: invoiceCounters.lastSeq });
      const number = formatInvoiceNumber(prefix, fy, c.seq);
      const doc = buildInvoiceDoc(o, {
        number,
        appName,
        supportEmail,
        website: siteUrl(),
        logo,
        terms: billing?.terms ?? null,
        currentBusinessState: billing?.state ?? null,
      });
      const [row] = await tx
        .insert(invoices)
        .values({
          orderId: o.id,
          userId: o.userId,
          number,
          series,
          seq: c.seq,
          financialYear: fy,
          mode: o.mode,
          issuedAt: o.paidAt!,
          templateVersion: doc.templateVersion,
          totalAmount: o.totalAmount,
          doc,
        })
        .returning({ id: invoices.id, number: invoices.number });
      return row;
    });
  } catch (e) {
    // Another call issued it a moment ago (unique order): that one stands.
    const again = await existing();
    if (again) return again;
    throw e;
  }
}

/**
 * Issues any missing invoices for paid orders, oldest payment first, so
 * numbers follow payment order (the backfill, and a safety net if an invoice
 * failed right after a payment). Runs at server start. Returns how many.
 */
export async function issueMissingInvoices(): Promise<number> {
  const missing = await db
    .select({ id: paymentOrders.id })
    .from(paymentOrders)
    .leftJoin(invoices, eq(invoices.orderId, paymentOrders.id))
    .where(and(eq(paymentOrders.status, "paid"), isNull(invoices.id)))
    .orderBy(asc(paymentOrders.paidAt), asc(paymentOrders.number));
  let issued = 0;
  for (const m of missing) {
    try {
      if (await ensureInvoice(m.id)) issued++;
    } catch (e) {
      console.error(`[invoices] couldn't issue the invoice for order ${m.id}:`, e instanceof Error ? e.message : e);
    }
  }
  return issued;
}
