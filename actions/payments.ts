"use server";

// Plan checkout (user side). The browser only ever sends a plan + period to
// start, and the gateway's ids + signature to finish; the amount, the term and
// whether the payment really went through are all decided on the server.

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { paymentOrders } from "@/db/schema";
import { getSessionUser } from "@/lib/current-user";
import { getGatewayRow, credsOf } from "@/lib/payments/gateways";
import { checkoutSignatureOk, fetchPayment, RazorpayError } from "@/lib/payments/razorpay";
import { confirmPayment, markOrder, startCheckout, type ConfirmResult, type StartResult } from "@/lib/payments/orders";

const startSchema = z.object({
  planId: z.string().uuid(),
  period: z.enum(["monthly", "yearly"]),
});

export async function startCheckoutAction(raw: unknown): Promise<StartResult> {
  const u = await getSessionUser();
  if (!u) return { ok: false, error: "Please sign in again." };
  const parsed = startSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Pick a plan and billing period." };
  return startCheckout(u.id, parsed.data.planId, parsed.data.period);
}

const idPattern = /^[A-Za-z0-9_]{6,64}$/;
const verifySchema = z.object({
  orderId: z.string().uuid(),
  razorpayOrderId: z.string().regex(idPattern),
  razorpayPaymentId: z.string().regex(idPattern),
  razorpaySignature: z.string().regex(/^[0-9a-f]{64}$/i),
});

/** Checkout's success handler: check the signature, then fetch the payment
 *  from Razorpay and confirm the amount before applying the plan. */
export async function verifyCheckoutAction(raw: unknown): Promise<ConfirmResult> {
  const u = await getSessionUser();
  if (!u) return { ok: false, error: "Please sign in again." };
  const parsed = verifySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "We couldn't read the payment details." };
  const v = parsed.data;

  const [order] = await db
    .select()
    .from(paymentOrders)
    .where(and(eq(paymentOrders.id, v.orderId), eq(paymentOrders.userId, u.id)));
  if (!order || order.gatewayOrderId !== v.razorpayOrderId) return { ok: false, error: "Order not found." };

  const row = await getGatewayRow("razorpay");
  const creds = row ? credsOf(row) : null;
  if (!creds) return { ok: false, error: "Payments are being set up. If you were charged, contact support." };
  if (!checkoutSignatureOk(creds.keySecret, v.razorpayOrderId, v.razorpayPaymentId, v.razorpaySignature)) {
    console.warn(`[payments] bad checkout signature for order ${order.id}`);
    return { ok: false, error: "We couldn't verify this payment. If you were charged, contact support." };
  }

  try {
    const payment = await fetchPayment(creds, v.razorpayPaymentId);
    return await confirmPayment(order, payment, creds);
  } catch (err) {
    console.error("[payments] verify:", err instanceof Error ? err.message : err);
    return {
      ok: false,
      error:
        err instanceof RazorpayError
          ? "We couldn't confirm the payment with Razorpay yet. If you were charged, your plan updates within a few minutes."
          : "Something went wrong confirming the payment. If you were charged, contact support.",
    };
  }
}

const closeSchema = z.object({
  orderId: z.string().uuid(),
  outcome: z.enum(["cancelled", "failed"]),
  reason: z.string().max(300).optional(),
});

/** The payment window was closed, or a payment attempt failed. */
export async function closeCheckoutAction(raw: unknown): Promise<{ ok: boolean }> {
  const u = await getSessionUser();
  if (!u) return { ok: false };
  const parsed = closeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false };
  const { orderId, outcome, reason } = parsed.data;
  const [order] = await db
    .select({ id: paymentOrders.id })
    .from(paymentOrders)
    .where(and(eq(paymentOrders.id, orderId), eq(paymentOrders.userId, u.id)));
  if (!order) return { ok: false };
  await markOrder(order.id, outcome, reason?.trim() || null);
  return { ok: true };
}
