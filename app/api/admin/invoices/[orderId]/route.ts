import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { paymentOrders } from "@/db/schema";
import { requireAdmin } from "@/lib/current-user";
import { logoForInvoice } from "@/lib/invoices/logo";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import { previewInvoiceNumbers } from "@/lib/invoices/preview-numbers";
import { sampleInvoiceGstOff } from "@/lib/invoices/sample";

// INVOICES PHASE 1 (UI first, docs/invoices/spec.md): admin Orders & payments →
// Download invoice. Invoices aren't stored yet, so this draws a PREVIEW from the
// real order (number as the backfill will give it, item, amounts, payment) with
// the sample seller details and no buyer address, since none was collected.
// Phase 3 serves the stored, frozen invoice instead. Admins only; drawn in
// memory and never written to disk.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  await requireAdmin();
  const { orderId } = await params;
  if (!z.string().uuid().safeParse(orderId).success) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const [o] = await db.select().from(paymentOrders).where(eq(paymentOrders.id, orderId)).limit(1);
  const number = o ? (await previewInvoiceNumbers()).get(o.id) : undefined;
  if (!o || o.status !== "paid" || !o.paidAt || !number) return NextResponse.json({ error: "Only a paid order has an invoice." }, { status: 404 });

  const base = sampleInvoiceGstOff(await logoForInvoice());
  const isPlan = o.kind !== "ai_interview";
  const dates = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Kolkata" });
  const pdf = await renderInvoicePdf({
    ...base,
    number,
    issuedAt: o.paidAt.toISOString(),
    buyer: {
      ...base.buyer,
      name: o.userName || "Customer",
      addressLines: ["Billing address not collected yet"],
      state: { name: "", code: "" },
      pin: "",
      email: o.userEmail,
      mobile: "",
    },
    lines: [
      {
        description: isPlan ? `${o.planName}${o.period ? `, ${o.period}` : ""}` : o.planName,
        detail: isPlan && o.termStartsAt && o.termEndsAt ? `${dates(o.termStartsAt)} to ${dates(o.termEndsAt)}` : null,
        sac: null,
        quantity: 1,
        taxable: o.totalAmount,
      },
    ],
    totals: { taxable: o.totalAmount, cgst: 0, sgst: 0, igst: 0, total: o.totalAmount },
    payment: { paidAt: o.paidAt.toISOString(), method: o.method, paymentId: o.gatewayPaymentId ?? "", orderNumber: String(o.number), gateway: "Razorpay" },
    terms: isPlan ? base.terms : [],
  });

  const download = request.nextUrl.searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${number.replace(/\//g, "-")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
