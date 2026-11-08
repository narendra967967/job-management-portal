import "server-only";

// Plan orders: create one for checkout, confirm it when the gateway says it's
// paid (Checkout handler or webhook, whichever comes first; both are safe to
// repeat), and record failures. The amount is always computed here, never
// taken from the browser. Spec: memory payments-plan.

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { paymentOrders, plans, user } from "@/db/schema";
import { getBillingProfile } from "@/lib/billing-data";
import { toPublicPlan } from "@/lib/pricing";
import {
  PERIOD_LABELS,
  billingReady,
  billingSnapshot,
  formatPaise,
  priceFor,
  quote,
  type BillingPeriod,
  type CurrentPlanInfo,
  type OfferPlan,
  type TaxSettings,
} from "@/lib/billing-model";
import { activeGateway } from "@/lib/payments/gateways";
import {
  RazorpayError,
  capturePayment,
  createOrder,
  type RazorpayCreds,
  type RazorpayPayment,
} from "@/lib/payments/razorpay";
import { sendTemplateEmail } from "@/lib/email-templates";
import { greetingName } from "@/lib/email-templates-model";
import { absoluteUrl } from "@/lib/site-url";
import { getAppName } from "@/lib/branding";

type Order = typeof paymentOrders.$inferSelect;

/** Orders a user may start per hour (stops a script filling the table). */
const ORDERS_PER_HOUR = 10;

/** "JOB-001201" */
export function receiptOf(o: Pick<Order, "receiptPrefix" | "number">): string {
  return `${o.receiptPrefix}${String(o.number).padStart(6, "0")}`;
}

/** The period of the user's last paid order for `planId` (upgrade credit maths). */
async function lastPaidPeriod(userId: string, planId: string): Promise<BillingPeriod | null> {
  const [o] = await db
    .select({ period: paymentOrders.period })
    .from(paymentOrders)
    .where(and(eq(paymentOrders.userId, userId), eq(paymentOrders.planId, planId), eq(paymentOrders.status, "paid")))
    .orderBy(desc(paymentOrders.paidAt))
    .limit(1);
  return o?.period ?? null;
}

/** The user's plan as checkout needs it. */
export async function currentPlanInfo(userId: string): Promise<CurrentPlanInfo> {
  const [row] = await db
    .select({ planId: user.planId, planExpiresAt: user.planExpiresAt })
    .from(user)
    .where(eq(user.id, userId));
  const [cur] = row?.planId ? await db.select().from(plans).where(eq(plans.id, row.planId)) : [];
  return {
    planId: cur?.id ?? null,
    name: cur?.name ?? "",
    isFree: cur?.isFree ?? true,
    monthlyPrice: cur?.monthlyPrice ?? 0,
    yearlyPrice: cur?.yearlyPrice ?? 0,
    expiresAt: row?.planExpiresAt ? row.planExpiresAt.toISOString() : null,
    lastPeriod: cur && !cur.isFree ? await lastPaidPeriod(userId, cur.id) : null,
  };
}

/** The tax admin Billing applies right now. */
export function taxOf(b: Awaited<ReturnType<typeof getBillingProfile>>): TaxSettings {
  return { gstRegistered: b.gstRegistered === true, taxRate: b.taxRate, pricesIncludeTax: b.pricesIncludeTax };
}

/** Online payment runs only with a gateway on AND Billing complete. */
export async function onlinePaymentAvailable(): Promise<boolean> {
  const [gw, billing] = await Promise.all([activeGateway(), getBillingProfile()]);
  return !!gw && billingReady(billing);
}

export interface CheckoutStart {
  orderId: string;
  gateway: "razorpay";
  keyId: string;
  gatewayOrderId: string;
  amount: number;
  currency: string;
  receipt: string;
  /** Shown at the top of the payment window. */
  merchantName: string;
  planName: string;
  period: BillingPeriod;
  prefill: { name: string; email: string; contact: string };
}

export type StartResult = { ok: true; checkout: CheckoutStart } | { ok: false; error: string; fallback?: boolean };

/** Create our order + the gateway order for `planId`/`period`. */
export async function startCheckout(userId: string, planId: string, period: BillingPeriod): Promise<StartResult> {
  const [u] = await db.select().from(user).where(eq(user.id, userId));
  if (!u || u.status === "inactive") return { ok: false, error: "Your account can't make payments right now." };

  const [pl] = await db.select().from(plans).where(eq(plans.id, planId));
  // Only plans the picker offers: active, paid, listed — or the user's own plan.
  const offered = !!pl && pl.status === "active" && !pl.isFree && (pl.showOnPricing || pl.id === u.planId);
  if (!pl || !offered) return { ok: false, error: "That plan isn't available. Refresh the page and pick again." };
  if (priceFor(pl, period) <= 0) return { ok: false, error: "That plan can't be bought for this billing period." };

  const [billing, gw] = await Promise.all([getBillingProfile(), activeGateway()]);
  if (!gw || !billingReady(billing)) {
    return { ok: false, fallback: true, error: "Online payment isn't available right now. Send us a request instead." };
  }

  const [{ recent }] = await db
    .select({ recent: sql<number>`count(*)::int` })
    .from(paymentOrders)
    .where(and(eq(paymentOrders.userId, userId), gte(paymentOrders.createdAt, new Date(Date.now() - 3_600_000))));
  if (recent >= ORDERS_PER_HOUR) {
    return { ok: false, error: "Too many payment attempts in the last hour. Please try again a little later." };
  }

  const current = await currentPlanInfo(userId);
  const tax = taxOf(billing);
  const q = quote({ plan: toPublicPlan(pl), period, current, tax });
  if (q.total < 100) return { ok: false, error: "That amount is too small to charge online." };

  const [order] = await db
    .insert(paymentOrders)
    .values({
      receiptPrefix: billing.invoicePrefix.trim(),
      userId,
      userName: u.name,
      userEmail: u.email,
      planId: pl.id,
      planName: pl.name,
      period,
      kind: q.kind,
      currency: q.currency,
      baseAmount: q.base,
      taxAmount: q.tax,
      totalAmount: q.total,
      taxRate: q.taxRate,
      pricesIncludeTax: q.pricesIncludeTax,
      creditDays: q.creditDays,
      gateway: gw.id,
      mode: gw.row.mode,
      // Tax + seller details used for this amount; never changed afterwards.
      billingSnapshot: billingSnapshot(billing),
    })
    .returning();
  const receipt = receiptOf(order);

  try {
    const rz = await createOrder(gw.creds, {
      amount: q.total,
      currency: q.currency,
      receipt: receipt.slice(0, 40),
      notes: { order_id: order.id, user_id: userId, plan: pl.name, period },
    });
    await db.update(paymentOrders).set({ gatewayOrderId: rz.id }).where(eq(paymentOrders.id, order.id));
    return {
      ok: true,
      checkout: {
        orderId: order.id,
        gateway: "razorpay",
        keyId: gw.creds.keyId,
        gatewayOrderId: rz.id,
        amount: q.total,
        currency: q.currency,
        receipt,
        merchantName: await getAppName(),
        planName: pl.name,
        period,
        prefill: { name: u.name, email: u.email, contact: u.mobile ?? "" },
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[payments] create order failed:", msg);
    await db
      .update(paymentOrders)
      .set({ status: "failed", failedAt: new Date(), failureReason: `Couldn't start the payment: ${msg}`.slice(0, 500) })
      .where(eq(paymentOrders.id, order.id));
    return { ok: false, error: "We couldn't start the payment. Please try again in a moment." };
  }
}

export type ConfirmResult =
  | { ok: true; expiresAt: string; planName: string; alreadyPaid: boolean }
  | { ok: false; error: string };

/**
 * Confirm `order` against the gateway's payment record and, if it really is
 * paid in full, apply the plan. Idempotent: a second call for a paid order
 * returns the same result without changing anything.
 */
export async function confirmPayment(order: Order, payment: RazorpayPayment, creds: RazorpayCreds): Promise<ConfirmResult> {
  if (payment.order_id !== order.gatewayOrderId) return { ok: false, error: "That payment belongs to another order." };
  if (payment.amount !== order.totalAmount || payment.currency !== order.currency) {
    console.error(`[payments] amount mismatch on order ${order.id}: got ${payment.amount} ${payment.currency}`);
    return { ok: false, error: "The amount paid doesn't match this order. Contact support and we'll sort it out." };
  }

  let p = payment;
  if (p.status === "authorized") {
    try {
      p = await capturePayment(creds, p.id, order.totalAmount, order.currency);
    } catch (err) {
      // Captured meanwhile (webhook, auto-capture) is fine; re-checked below.
      if (!(err instanceof RazorpayError)) throw err;
      console.warn("[payments] capture:", err.message);
    }
  }
  if (p.status !== "captured") return { ok: false, error: "The payment hasn't completed yet." };

  const result = await db.transaction(async (tx) => {
    const [o] = await tx.select().from(paymentOrders).where(eq(paymentOrders.id, order.id)).for("update");
    if (!o) return null;
    if (o.status === "paid") {
      return { expiresAt: o.termEndsAt!, planName: o.planName, alreadyPaid: true };
    }

    const now = new Date();
    // The term is worked out at payment time from the user's plan right now
    // (a renewal stacks on the latest expiry; an upgrade credits what's left).
    let termStart = now;
    let termEnd = now;
    let kind = o.kind;
    let creditDays = 0;
    if (o.userId) {
      const [u] = await tx
        .select({ planId: user.planId, planExpiresAt: user.planExpiresAt })
        .from(user)
        .where(eq(user.id, o.userId))
        .for("update");
      const [cur] = u?.planId ? await tx.select().from(plans).where(eq(plans.id, u.planId)) : [];
      const [pl] = o.planId ? await tx.select().from(plans).where(eq(plans.id, o.planId)) : [];
      const bought: OfferPlan = pl
        ? toPublicPlan(pl)
        : ({ id: o.planId ?? "", name: o.planName, currency: o.currency, monthlyPrice: 0, yearlyPrice: 0 } as OfferPlan);
      const q = quote({
        plan: bought,
        period: o.period,
        current: {
          planId: cur?.id ?? null,
          name: cur?.name ?? "",
          isFree: cur?.isFree ?? true,
          monthlyPrice: cur?.monthlyPrice ?? 0,
          yearlyPrice: cur?.yearlyPrice ?? 0,
          expiresAt: u?.planExpiresAt ? u.planExpiresAt.toISOString() : null,
          lastPeriod: cur && !cur.isFree ? await lastPaidPeriod(o.userId, cur.id) : null,
        },
        tax: { gstRegistered: false, taxRate: 0, pricesIncludeTax: false }, // dates only
        now,
      });
      termStart = new Date(q.startsAt);
      termEnd = new Date(q.expiresAt);
      kind = q.kind;
      creditDays = q.creditDays;
      if (o.planId) {
        await tx.update(user).set({ planId: o.planId, planExpiresAt: termEnd }).where(eq(user.id, o.userId));
      }
    }

    await tx
      .update(paymentOrders)
      .set({
        status: "paid",
        paidAt: now,
        gatewayPaymentId: p.id,
        method: p.method,
        kind,
        creditDays,
        termStartsAt: termStart,
        termEndsAt: termEnd,
        failureReason: null,
      })
      .where(eq(paymentOrders.id, o.id));
    return { expiresAt: termEnd, planName: o.planName, alreadyPaid: false };
  });

  if (!result) return { ok: false, error: "Order not found." };
  if (!result.alreadyPaid) {
    sendReceipt(order.id).catch((err) => console.error("[payments] receipt email failed:", err instanceof Error ? err.message : err));
  }
  return { ok: true, expiresAt: result.expiresAt.toISOString(), planName: result.planName, alreadyPaid: result.alreadyPaid };
}

/** Record a failed or abandoned attempt. Never touches a paid order. */
export async function markOrder(
  orderId: string,
  status: "failed" | "cancelled",
  reason: string | null,
): Promise<void> {
  const now = new Date();
  await db
    .update(paymentOrders)
    .set(
      status === "failed"
        ? { status, failedAt: now, failureReason: reason?.slice(0, 500) ?? "Payment failed" }
        : { status, cancelledAt: now, failureReason: reason?.slice(0, 500) ?? "Closed the payment window" },
    )
    .where(
      and(
        eq(paymentOrders.id, orderId),
        // A cancel never overwrites a failure; nothing overwrites "paid".
        status === "failed" ? inArray(paymentOrders.status, ["created", "cancelled"]) : eq(paymentOrders.status, "created"),
      ),
    );
}

const dateOnly = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Email the payment receipt for a paid order (also "Resend receipt" in admin). */
export async function sendReceipt(orderId: string): Promise<void> {
  const [o] = await db.select().from(paymentOrders).where(eq(paymentOrders.id, orderId));
  if (!o || o.status !== "paid" || !o.userEmail) throw new Error("Only a paid order with an email has a receipt.");
  const money = (p: number) => formatPaise(p, o.currency);
  const rows: [string, string][] = [
    ["Receipt number", receiptOf(o)],
    ["Date", dateOnly(o.paidAt ?? o.createdAt)],
    ["Plan", `${o.planName}, billed ${PERIOD_LABELS[o.period].toLowerCase()}`],
    ["Active until", o.termEndsAt ? dateOnly(o.termEndsAt) : ""],
    ...(o.taxAmount > 0
      ? ([
          ["Price", money(o.baseAmount)],
          [`GST (${o.taxRate}%)`, money(o.taxAmount)],
        ] as [string, string][])
      : []),
    ["Total paid", money(o.totalAmount)],
    ...(o.method ? ([["Paid by", o.method.toUpperCase() === "UPI" ? "UPI" : o.method[0].toUpperCase() + o.method.slice(1)]] as [string, string][]) : []),
    ["Payment ID", o.gatewayPaymentId ?? ""],
  ];
  const table = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:8px 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:7px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;">${esc(k)}</td><td style="padding:7px 0;border-bottom:1px solid #E5E7EB;color:#111827;text-align:right;font-weight:${k === "Total paid" ? "bold" : "normal"};">${esc(v)}</td></tr>`,
    )
    .join("")}</table>`;
  // Wording: admin Engagement → Email templates ("Payment received").
  await sendTemplateEmail("payment_received", {
    to: o.userEmail,
    values: {
      user_name: greetingName(o.userName),
      plan_name: o.planName,
      active_until: o.termEndsAt ? dateOnly(o.termEndsAt) : "the end of its term",
      total_paid: money(o.totalAmount),
      receipt_details: table,
    },
    buttonUrl: absoluteUrl("/settings?tab=plan"),
  });
}
