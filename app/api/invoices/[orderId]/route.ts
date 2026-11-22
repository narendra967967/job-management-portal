import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { invoices, paymentOrders } from "@/db/schema";
import { getSessionUserId } from "@/lib/current-user";
import { invoiceDenied } from "@/lib/invoices/denied";
import { ensureInvoice } from "@/lib/invoices/issue";
import type { InvoiceDoc } from "@/lib/invoices/model";
import { renderInvoicePdf } from "@/lib/invoices/pdf";

// The signed-in user's invoice for one of their own orders (Orders &
// payments → Download / View invoice). Drawn in memory from the frozen copy
// in invoices.doc and streamed; nothing is written to disk (spec I8). Someone
// else's order, or an unpaid one, looks exactly like one that doesn't exist.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return invoiceDenied(request, "signin");
  const { orderId } = await params;
  if (!z.string().uuid().safeParse(orderId).success) return invoiceDenied(request, "missing");

  const [own] = await db
    .select({ id: paymentOrders.id })
    .from(paymentOrders)
    .where(and(eq(paymentOrders.id, orderId), eq(paymentOrders.userId, userId), eq(paymentOrders.status, "paid")))
    .limit(1);
  if (!own) return invoiceDenied(request, "missing");

  // Normally issued at payment; this covers one that's still missing.
  await ensureInvoice(own.id).catch((e) => console.error("[invoices] issue on download failed:", e instanceof Error ? e.message : e));
  const [inv] = await db.select({ number: invoices.number, doc: invoices.doc }).from(invoices).where(eq(invoices.orderId, own.id)).limit(1);
  if (!inv) return invoiceDenied(request, "missing");

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
