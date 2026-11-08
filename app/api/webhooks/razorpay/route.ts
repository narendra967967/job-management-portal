import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { paymentOrders } from "@/db/schema";
import { credsOf, getGatewayRow, webhookSecretOf } from "@/lib/payments/gateways";
import { webhookSignatureOk, type RazorpayPayment } from "@/lib/payments/razorpay";
import { confirmPayment, markOrder } from "@/lib/payments/orders";

// Razorpay webhooks (payment.captured, order.paid, payment.failed). The safety
// net for checkout: if the user closes the tab before the success handler
// runs, the plan is still applied here. The signature is checked against the
// raw body BEFORE anything is parsed or touched; anything unsigned gets 401.

export const dynamic = "force-dynamic";

const MAX_BODY = 256 * 1024;

export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const raw = await request.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "Too large" }, { status: 413 });

  const row = await getGatewayRow("razorpay");
  const secret = row ? webhookSecretOf(row) : null;
  if (!row || !secret || !signature || !webhookSignatureOk(secret, raw, signature)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let event: { event?: string; payload?: { payment?: { entity?: RazorpayPayment } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const payment = event.payload?.payment?.entity;
  if (!payment?.order_id) return NextResponse.json({ ok: true, ignored: true });

  const [order] = await db
    .select()
    .from(paymentOrders)
    .where(and(eq(paymentOrders.gateway, "razorpay"), eq(paymentOrders.gatewayOrderId, payment.order_id)));
  // Not ours (another app on the same Razorpay account): acknowledge and stop.
  if (!order) return NextResponse.json({ ok: true, ignored: true });

  if (event.event === "payment.captured" || event.event === "order.paid") {
    const creds = credsOf(row);
    if (!creds) return NextResponse.json({ error: "Gateway keys unavailable" }, { status: 503 });
    const res = await confirmPayment(order, payment, creds);
    if (!res.ok) console.error(`[webhook] ${event.event} for order ${order.id}: ${res.error}`);
    // 200 either way: a retry won't change a mismatch, and it's logged.
    return NextResponse.json({ ok: res.ok });
  }

  if (event.event === "payment.failed") {
    await markOrder(order.id, "failed", payment.error_description ?? null);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, ignored: true });
}
