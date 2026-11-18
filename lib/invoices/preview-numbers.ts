import "server-only";

// INVOICES PHASE 1 (UI first, docs/invoices/spec.md): the invoice numbers the
// phase 3 backfill will give existing paid orders, shown in admin Orders &
// payments before invoices exist. Same rule as the backfill: paid orders in
// payment order, numbered from 1 within each financial year (April to March).
// Live payments use the Billing prefix; test-mode payments (no real money)
// get their own TEST/ series so they never use up real invoice numbers.
// Phase 3 replaces this with the numbers stored in the invoices table.

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { billingConfig, paymentOrders } from "@/db/schema";
import { financialYear, formatInvoiceNumber } from "@/lib/invoices/model";

export const TEST_INVOICE_PREFIX = "TEST/";

export async function previewInvoiceNumbers(): Promise<Map<string, string>> {
  const [billing] = await db.select({ prefix: billingConfig.invoicePrefix }).from(billingConfig).limit(1);
  const livePrefix = billing?.prefix || "JOB-";
  const paid = await db
    .select({ id: paymentOrders.id, paidAt: paymentOrders.paidAt, mode: paymentOrders.mode })
    .from(paymentOrders)
    .where(eq(paymentOrders.status, "paid"))
    .orderBy(asc(paymentOrders.paidAt), asc(paymentOrders.number));
  const next = new Map<string, number>();
  const out = new Map<string, string>();
  for (const o of paid) {
    if (!o.paidAt) continue;
    const fy = financialYear(o.paidAt);
    const prefix = o.mode === "live" ? livePrefix : TEST_INVOICE_PREFIX;
    const key = `${prefix}|${fy}`;
    const seq = (next.get(key) ?? 0) + 1;
    next.set(key, seq);
    out.set(o.id, formatInvoiceNumber(prefix, fy, seq));
  }
  return out;
}
