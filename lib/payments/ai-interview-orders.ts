import "server-only";

// Paying for an AI mock interview outside the allowance (interview-prep spec
// D5, D34). The booking is made first as pending_payment; the order points to
// it and carries the price fixed at booking. The amount is never taken from
// the browser. Confirmation is idempotent (Checkout handler or webhook).

import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiInterviews, paymentOrders, user } from "@/db/schema";
import { getBillingProfile } from "@/lib/billing-data";
import { billingReady, billingSnapshot, formatPaise, taxSplit } from "@/lib/billing-model";
import { activeGateway } from "@/lib/payments/gateways";
import { RazorpayError, capturePayment, createOrder, type RazorpayCreds, type RazorpayPayment } from "@/lib/payments/razorpay";
import { sendTemplateEmail } from "@/lib/email-templates";
import { greetingName } from "@/lib/email-templates-model";
import { absoluteUrl } from "@/lib/site-url";
import { getAppName } from "@/lib/branding";
import { BILLING_NEEDED, receiptOf, taxOf, type ConfirmResult } from "@/lib/payments/orders";
import { getUserBilling } from "@/lib/invoices/billing-profile";
import { isBillingComplete } from "@/lib/invoices/billing-details";
import { splitTax } from "@/lib/invoices/tax";

type Order = typeof paymentOrders.$inferSelect;
const ORDERS_PER_HOUR = 10;

export const interviewLabel = (i: { durationMin: number; difficulty: string }) => `AI mock interview: ${i.durationMin} min, ${i.difficulty}`;

export interface AiCheckoutStart {
  orderId: string;
  keyId: string;
  gatewayOrderId: string;
  amount: number;
  currency: string;
  merchantName: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
}

/** Whether online payment can run now (a gateway on and Billing complete). */
export async function aiPaymentAvailable(): Promise<boolean> {
  const [gw, billing] = await Promise.all([activeGateway(), getBillingProfile()]);
  return !!gw && billingReady(billing);
}

/** Create our order and the gateway's for a pending_payment booking. */
export async function startAiInterviewCheckout(
  userId: string,
  interviewId: string,
): Promise<{ ok: true; checkout: AiCheckoutStart } | { ok: false; error: string; /** Billing details are missing or incomplete. */ needsBilling?: boolean }> {
  const [u] = await db.select().from(user).where(eq(user.id, userId));
  if (!u || u.status === "inactive") return { ok: false, error: "Your account can't make payments right now." };
  const [i] = await db
    .select()
    .from(aiInterviews)
    .where(and(eq(aiInterviews.id, interviewId), eq(aiInterviews.userId, userId)));
  if (!i || i.status !== "pending_payment" || i.coverage !== "paid") return { ok: false, error: "That booking isn't waiting for payment." };

  const [billing, gw] = await Promise.all([getBillingProfile(), activeGateway()]);
  if (!gw || !billingReady(billing)) return { ok: false, error: "Online payment isn't available right now. Please try again later." };

  const [{ recent }] = await db
    .select({ recent: sql<number>`count(*)::int` })
    .from(paymentOrders)
    .where(and(eq(paymentOrders.userId, userId), gte(paymentOrders.createdAt, new Date(Date.now() - 3_600_000))));
  if (recent >= ORDERS_PER_HOUR) return { ok: false, error: "Too many payment attempts in the last hour. Please try again a little later." };

  // No payment without complete billing details, GST on or off (invoices spec I4).
  const buyer = await getUserBilling(userId);
  if (!isBillingComplete(buyer)) return { ok: false, needsBilling: true, error: BILLING_NEEDED };

  // Every price shown is the final price, GST included (D34).
  const split = taxSplit(i.pricePaise / 100, { ...taxOf(billing), pricesIncludeTax: true });
  if (split.total < 100) return { ok: false, error: "That amount is too small to charge online." };
  const gst = splitTax(split.tax, { registered: billing.gstRegistered === true, sellerState: billing.businessState || null, buyerState: buyer.stateCode });
  const currency = "INR";
  const label = interviewLabel(i);
  const [order] = await db
    .insert(paymentOrders)
    .values({
      receiptPrefix: billing.invoicePrefix.trim(),
      userId,
      userName: u.name,
      userEmail: u.email,
      planName: label,
      period: null,
      kind: "ai_interview",
      aiInterviewId: i.id,
      currency,
      baseAmount: split.base,
      taxAmount: split.tax,
      totalAmount: split.total,
      taxRate: taxOf(billing).gstRegistered ? billing.taxRate : 0,
      pricesIncludeTax: true,
      gateway: gw.id,
      mode: gw.row.mode,
      billingSnapshot: billingSnapshot(billing),
      buyerSnapshot: buyer,
      cgstAmount: gst.cgst,
      sgstAmount: gst.sgst,
      igstAmount: gst.igst,
      placeOfSupply: gst.placeOfSupply,
    })
    .returning();

  try {
    const rz = await createOrder(gw.creds, {
      amount: split.total,
      currency,
      receipt: receiptOf(order).slice(0, 40),
      notes: { order_id: order.id, user_id: userId, ai_interview_id: i.id },
    });
    await db.update(paymentOrders).set({ gatewayOrderId: rz.id }).where(eq(paymentOrders.id, order.id));
    return {
      ok: true,
      checkout: {
        orderId: order.id,
        keyId: gw.creds.keyId,
        gatewayOrderId: rz.id,
        amount: split.total,
        currency,
        merchantName: await getAppName(),
        description: label,
        prefill: { name: u.name, email: u.email, contact: u.mobile ?? "" },
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[payments] create AI interview order failed:", msg);
    await db
      .update(paymentOrders)
      .set({ status: "failed", failedAt: new Date(), failureReason: `Couldn't start the payment: ${msg}`.slice(0, 500) })
      .where(eq(paymentOrders.id, order.id));
    return { ok: false, error: "We couldn't start the payment. Please try again in a moment." };
  }
}

/**
 * Confirm an AI interview order against the gateway's payment and, when it's
 * paid in full, make its booking ready. The booking's 30-day (or whatever
 * admin set) validity starts at payment.
 */
export async function confirmAiInterviewPayment(order: Order, payment: RazorpayPayment, creds: RazorpayCreds): Promise<ConfirmResult> {
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
      if (!(err instanceof RazorpayError)) throw err;
      console.warn("[payments] capture:", err.message);
    }
  }
  if (p.status !== "captured") return { ok: false, error: "The payment hasn't completed yet." };

  const result = await db.transaction(async (tx) => {
    const [o] = await tx.select().from(paymentOrders).where(eq(paymentOrders.id, order.id)).for("update");
    if (!o) return null;
    const [i] = o.aiInterviewId ? await tx.select().from(aiInterviews).where(eq(aiInterviews.id, o.aiInterviewId)).for("update") : [];
    if (o.status === "paid") return { validUntil: i?.validUntil ?? new Date(), label: o.planName, alreadyPaid: true };

    const now = new Date();
    let validUntil = now;
    if (i && i.status === "pending_payment") {
      validUntil = new Date(now.getTime() + i.settings.bookingValidDays * 86_400_000);
      await tx.update(aiInterviews).set({ status: "ready", validUntil }).where(eq(aiInterviews.id, i.id));
    } else {
      // Paid after the unpaid booking was cleared: keep the money record and say so.
      console.error(`[payments] AI interview order ${o.id} paid but its booking is gone; needs a refund or a manual booking`);
    }
    await tx
      .update(paymentOrders)
      .set({ status: "paid", paidAt: now, gatewayPaymentId: p.id, method: p.method, termStartsAt: now, termEndsAt: validUntil, failureReason: null })
      .where(eq(paymentOrders.id, o.id));
    return { validUntil, label: o.planName, alreadyPaid: false };
  });
  if (!result) return { ok: false, error: "Order not found." };
  if (!result.alreadyPaid) {
    sendAiInterviewReceipt(order.id).catch((err) => console.error("[payments] receipt email failed:", err instanceof Error ? err.message : err));
  }
  return { ok: true, expiresAt: result.validUntil.toISOString(), planName: result.label, alreadyPaid: result.alreadyPaid };
}

const dateOnly = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Kolkata" });
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Email the receipt for a paid AI interview order (also admin "Resend receipt"). */
export async function sendAiInterviewReceipt(orderId: string): Promise<void> {
  const [o] = await db.select().from(paymentOrders).where(eq(paymentOrders.id, orderId));
  if (!o || o.status !== "paid" || !o.userEmail) throw new Error("Only a paid order with an email has a receipt.");
  const money = (paise: number) => formatPaise(paise, o.currency);
  const validUntil = o.termEndsAt ? dateOnly(o.termEndsAt) : "";
  const rows: [string, string][] = [
    ["Receipt number", receiptOf(o)],
    ["Date", dateOnly(o.paidAt ?? o.createdAt)],
    ["Item", o.planName],
    ...(validUntil ? ([["Start it by", validUntil]] as [string, string][]) : []),
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
  // Wording: admin Engagement → Email templates ("AI interview payment received").
  await sendTemplateEmail("mock_interview_receipt", {
    to: o.userEmail,
    values: {
      user_name: greetingName(o.userName),
      interview_label: o.planName,
      valid_until: validUntil || "its expiry date",
      total_paid: money(o.totalAmount),
      receipt_details: table,
    },
    buttonUrl: absoluteUrl("/mock-interviews/ai"),
  });
}
