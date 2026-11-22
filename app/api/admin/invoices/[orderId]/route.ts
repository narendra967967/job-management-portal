import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { invoices } from "@/db/schema";
import { requireAdmin } from "@/lib/current-user";
import { ensureInvoice } from "@/lib/invoices/issue";
import type { InvoiceDoc } from "@/lib/invoices/model";
import { renderInvoicePdf } from "@/lib/invoices/pdf";

// Admin Orders & payments → Download invoice: any paid order's invoice, drawn
// in memory from its frozen copy (invoices.doc) and never written to disk.
// Admins only (requireAdmin sends anyone else to the admin sign-in).

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  await requireAdmin();
  const { orderId } = await params;
  if (!z.string().uuid().safeParse(orderId).success) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const issued = await ensureInvoice(orderId).catch(() => null);
  const [inv] = issued ? await db.select({ number: invoices.number, doc: invoices.doc }).from(invoices).where(eq(invoices.id, issued.id)).limit(1) : [];
  if (!inv) return NextResponse.json({ error: "Only a paid order has an invoice." }, { status: 404 });

  const pdf = await renderInvoicePdf(inv.doc as InvoiceDoc);
  const download = request.nextUrl.searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${inv.number.replace(/\//g, "-")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
