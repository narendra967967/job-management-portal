import "server-only";

// "Invoice copy" (admin Engagement → Email templates): one email carrying the
// PDFs of one or more paid orders, to the account's email. Sent when a user
// picks Email me the invoice in Orders & payments, or an admin picks Send
// invoice. PDFs are drawn in memory for the email only (spec I8).

import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { paymentOrders, sentEmailLog, user } from "@/db/schema";
import { sendTemplateEmail } from "@/lib/email-templates";
import { greetingName } from "@/lib/email-templates-model";
import { absoluteUrl } from "@/lib/site-url";
import { invoiceFile } from "@/lib/invoices/attachment";

/** At most this many invoices in one email, and copies a user can ask for per hour. */
export const INVOICES_PER_EMAIL = 20;
export const INVOICE_EMAILS_PER_HOUR = 10;

/** How many invoice copies this user was sent in the last hour (the request limit). */
export async function invoiceEmailsLastHour(userId: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(sentEmailLog)
    .where(and(eq(sentEmailLog.userId, userId), eq(sentEmailLog.templateKey, "invoice_copy"), gte(sentEmailLog.sentAt, new Date(Date.now() - 3_600_000))));
  return n;
}

/**
 * Emails the invoices of `orderIds` to the account they belong to. With
 * `ownerId`, only that user's orders count (the user's own request). Unpaid
 * orders are skipped. Returns how many invoices went out.
 */
export async function emailInvoiceCopies(orderIds: string[], ownerId?: string): Promise<{ sent: number; error?: string }> {
  const ids = [...new Set(orderIds)].slice(0, INVOICES_PER_EMAIL);
  if (!ids.length) return { sent: 0, error: "Pick at least one paid payment." };
  const orders = await db
    .select({ id: paymentOrders.id, userId: paymentOrders.userId, userName: paymentOrders.userName, orderEmail: paymentOrders.userEmail, accountEmail: user.email, accountName: user.name })
    .from(paymentOrders)
    .leftJoin(user, eq(user.id, paymentOrders.userId))
    .where(and(inArray(paymentOrders.id, ids), eq(paymentOrders.status, "paid"), ownerId ? eq(paymentOrders.userId, ownerId) : undefined))
    .orderBy(paymentOrders.paidAt);
  if (!orders.length) return { sent: 0, error: "None of those payments has an invoice." };
  // One email per account (an admin send is always a single order).
  const to = orders[0].accountEmail ?? orders[0].orderEmail;
  const mine = orders.filter((o) => (o.accountEmail ?? o.orderEmail) === to);
  if (!to) return { sent: 0, error: "There's no email address to send it to." };

  const files = (await Promise.all(mine.map((o) => invoiceFile(o.id)))).filter((f) => f !== null);
  if (!files.length) return { sent: 0, error: "None of those payments has an invoice." };
  const numbers = files.map((f) => f.number);
  await sendTemplateEmail("invoice_copy", {
    to,
    values: {
      user_name: greetingName(mine[0].accountName ?? mine[0].userName),
      invoice_word: files.length === 1 ? "invoice" : "invoices",
      invoice_list: numbers.length === 1 ? numbers[0] : `${numbers.slice(0, -1).join(", ")} and ${numbers.at(-1)}`,
    },
    buttonUrl: absoluteUrl("/orders"),
    attachments: files.map((f) => f.attachment),
  });
  return { sent: files.length };
}
