import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserId } from "@/lib/current-user";
import { logoForInvoice } from "@/lib/invoices/logo";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import { samplePayments } from "@/lib/invoices/payments-model";
import { sampleInvoiceGstOff } from "@/lib/invoices/sample";

// PHASE 1 (UI first, docs/invoices/spec.md): the invoice PDF for a SAMPLE row in
// Orders & payments, so Download shows the real layout. Signed-in users only.
// Phase 3 replaces this with the real route, which loads the signed-in user's
// own invoice by its order and refuses anyone else's.
// The PDF is drawn in memory and streamed; nothing is written to disk (I8).

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSessionUserId())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await params;
  const row = samplePayments().find((r) => r.id === id);
  if (!row || row.status !== "paid" || !row.invoiceNumber) return NextResponse.json({ error: "No invoice for this payment." }, { status: 404 });

  const base = sampleInvoiceGstOff(await logoForInvoice());
  const pdf = await renderInvoicePdf({
    ...base,
    number: row.invoiceNumber,
    issuedAt: row.at,
    lines: [{ description: row.kind === "plan" ? row.item : `${row.item}: ${row.detail}`, detail: row.kind === "plan" ? row.detail : null, sac: null, quantity: 1, taxable: row.amount }],
    totals: { taxable: row.amount, cgst: 0, sgst: 0, igst: 0, total: row.amount },
    payment: { ...base.payment, paidAt: row.at, method: row.method, paymentId: row.paymentId ?? "", orderNumber: row.orderNumber },
    // Interview terms wait for the interview refund policy (spec section 10a).
    terms: row.kind === "plan" ? base.terms : [],
  });

  const download = request.nextUrl.searchParams.get("download") === "1";
  const file = `${row.invoiceNumber.replace(/\//g, "-")}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${file}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
