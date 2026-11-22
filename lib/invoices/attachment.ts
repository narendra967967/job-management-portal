import "server-only";

// An order's invoice as an email attachment, drawn in memory from its frozen
// copy (spec I8: nothing written to disk). Issues the invoice first if it's
// somehow still missing.

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices } from "@/db/schema";
import type { MailAttachment } from "@/lib/mailer";
import { ensureInvoice } from "@/lib/invoices/issue";
import type { InvoiceDoc } from "@/lib/invoices/model";
import { renderInvoicePdf } from "@/lib/invoices/pdf";

export interface InvoiceFile {
  number: string;
  attachment: MailAttachment;
}

/** Null when the order isn't paid (no invoice). */
export async function invoiceFile(orderId: string): Promise<InvoiceFile | null> {
  const issued = await ensureInvoice(orderId);
  if (!issued) return null;
  const [inv] = await db.select({ number: invoices.number, doc: invoices.doc }).from(invoices).where(eq(invoices.id, issued.id)).limit(1);
  if (!inv) return null;
  return {
    number: inv.number,
    attachment: {
      filename: `Invoice ${inv.number.replace(/\//g, "-")}.pdf`,
      content: await renderInvoicePdf(inv.doc as InvoiceDoc),
      contentType: "application/pdf",
    },
  };
}
