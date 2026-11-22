"use server";

// Orders & payments (/orders): the signed-in user's own payment attempts,
// plans and AI mock interviews, with the invoice number of each paid one.
// Scoped to the session user; allowed in limited mode (invoices stay
// reachable after a plan ends). Money records are never deleted (spec I6).

import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, paymentOrders } from "@/db/schema";
import { getCurrentUserId } from "@/lib/current-user";
import { PERIOD_LABELS } from "@/lib/billing-model";
import type { PaymentRow, PaymentStatus } from "@/lib/invoices/payments-model";

const KIND_DETAIL = { new: "New plan", renew: "Renewal", upgrade: "Upgrade" } as const;
const methodLabel = (m: string | null) => (!m ? null : m.toLowerCase() === "upi" ? "UPI" : m[0].toUpperCase() + m.slice(1));

/** Newest first; the table filters by date on screen. Capped for safety. */
export async function listMyPaymentsAction(): Promise<PaymentRow[]> {
  const userId = await getCurrentUserId();
  const rows = await db
    .select({ o: paymentOrders, invoiceNumber: invoices.number })
    .from(paymentOrders)
    .leftJoin(invoices, eq(invoices.orderId, paymentOrders.id))
    .where(eq(paymentOrders.userId, userId))
    .orderBy(desc(paymentOrders.createdAt))
    .limit(500);
  return rows.map(({ o, invoiceNumber }) => {
    const isPlan = o.kind !== "ai_interview";
    // "AI mock interview: 30 min, Medium" → item + "30 min, Medium"
    const [aiItem, aiDetail] = o.planName.split(": ");
    const status: PaymentStatus = o.status === "created" ? "pending" : o.status;
    return {
      id: o.id,
      at: (o.paidAt ?? o.createdAt).toISOString(),
      invoiceNumber: o.status === "paid" ? (invoiceNumber ?? null) : null,
      kind: isPlan ? "plan" : "ai_interview",
      item: isPlan ? `${o.planName} plan${o.period ? `, ${PERIOD_LABELS[o.period].toLowerCase()}` : ""}` : aiItem,
      detail: isPlan ? KIND_DETAIL[o.kind as keyof typeof KIND_DETAIL] ?? null : (aiDetail ?? null),
      amount: o.totalAmount,
      status,
      method: methodLabel(o.method),
      paymentId: o.gatewayPaymentId,
      orderNumber: String(o.number),
      failureReason: o.status === "failed" ? o.failureReason : null,
    };
  });
}
