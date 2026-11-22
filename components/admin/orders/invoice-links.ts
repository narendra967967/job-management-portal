import { toast } from "@/components/admin/ui/toast";
import { sendInvoiceAction } from "@/actions/admin-payments";

// Admin Orders & payments → the order's invoice (docs/invoices/spec.md): drawn
// on request from its frozen copy (app/api/admin/invoices/[orderId]), or
// emailed to the account with the Invoice copy template.

export const invoiceHref = (orderId: string, download: boolean) => `/api/admin/invoices/${orderId}${download ? "?download=1" : ""}`;

export async function sendInvoice(orderId: string, invoiceNumber: string): Promise<void> {
  const r = await sendInvoiceAction({ orderId }).catch(() => ({ ok: false as const, error: "Something went wrong. Try again." }));
  if (r.ok) toast.success("Invoice sent", `${invoiceNumber} is on its way to the customer.`);
  else toast.error("Not sent", r.error);
}
