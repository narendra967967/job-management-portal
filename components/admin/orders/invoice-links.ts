import { toast } from "@/components/admin/ui/toast";

// INVOICES PHASE 1 (docs/invoices/spec.md): admin Orders & payments → the order's
// invoice, drawn on request (app/api/admin/invoices/[orderId]). Sending is
// switched on with the server wiring in phase 3.

export const invoiceHref = (orderId: string, download: boolean) => `/api/admin/invoices/${orderId}${download ? "?download=1" : ""}`;

export const sendInvoiceSoon = () =>
  toast.info("Not switched on yet", "Invoices are emailed from the next update. Resend receipt in View details still works.");
