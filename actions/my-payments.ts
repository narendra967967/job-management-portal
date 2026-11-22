"use server";

// Orders & payments (/orders): the signed-in user's own payment attempts,
// plans and AI mock interviews, with the invoice number of each paid one.
// Scoped to the session user; allowed in limited mode (invoices stay
// reachable after a plan ends). Money records are never deleted (spec I6).

import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, paymentOrders } from "@/db/schema";
import { getCurrentUserId } from "@/lib/current-user";
import { PERIOD_LABELS } from "@/lib/billing-model";
import type { PaymentRow, PaymentStatus } from "@/lib/invoices/payments-model";
import { INVOICES_PER_EMAIL, INVOICE_EMAILS_PER_HOUR, emailInvoiceCopies, invoiceEmailsLastHour } from "@/lib/invoices/email";
import { SMTP_NOT_CONFIGURED } from "@/lib/mailer";

/** Email me the invoice(s): the user's own paid orders only, one email, a few an hour. */
export async function emailMyInvoicesAction(raw: unknown): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  const userId = await getCurrentUserId();
  const p = z.array(z.string().uuid()).min(1).max(INVOICES_PER_EMAIL).safeParse(raw);
  if (!p.success) return { ok: false, error: `Pick between 1 and ${INVOICES_PER_EMAIL} payments.` };
  if ((await invoiceEmailsLastHour(userId)) >= INVOICE_EMAILS_PER_HOUR) {
    return { ok: false, error: "You've asked for a lot of invoice emails in the last hour. Download them instead, or try again later." };
  }
  try {
    const r = await emailInvoiceCopies(p.data, userId);
    return r.sent ? { ok: true, sent: r.sent } : { ok: false, error: r.error ?? "Nothing was sent." };
  } catch (e) {
    if (e instanceof Error && e.message === SMTP_NOT_CONFIGURED) return { ok: false, error: "Email isn't working right now. Download the invoice instead." };
    console.error("[invoices] invoice email failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "We couldn't send it. Try again in a moment, or download it instead." };
  }
}

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
