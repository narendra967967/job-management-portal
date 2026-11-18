// User Settings → Payments (docs/invoices/spec.md, section 7): one row per
// payment attempt. Only a paid order has an invoice. Shapes are shared by the
// screen and (phase 3) the server action that loads the user's own rows.

export type PaymentStatus = "paid" | "failed" | "pending" | "cancelled";
export type SaleKind = "plan" | "ai_interview";

export interface PaymentRow {
  id: string;
  /** ISO time the payment was made, or the attempt started. */
  at: string;
  /** Null until paid. */
  invoiceNumber: string | null;
  kind: SaleKind;
  item: string;
  detail: string | null;
  /** Paise, what was paid or would have been. */
  amount: number;
  status: PaymentStatus;
  method: string | null;
  paymentId: string | null;
  orderNumber: string;
  failureReason: string | null;
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: "Paid",
  failed: "Failed",
  pending: "Not completed",
  cancelled: "Cancelled",
};

export const SALE_KIND_LABELS: Record<SaleKind, string> = {
  plan: "Plan",
  ai_interview: "AI mock interview",
};

/** The table's default window: the last 6 months (owner, November 18, 2026). */
export const PAYMENTS_DEFAULT_DAYS = 183;

/** Made-up rows for the phase 1 screens. */
export function samplePayments(now = new Date()): PaymentRow[] {
  const ago = (days: number, hour = 11) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    d.setHours(hour, 24, 0, 0);
    return d.toISOString();
  };
  return [
    { id: "s1", at: ago(0), invoiceNumber: "JT/26-27/00009", kind: "plan", item: "Pro plan, monthly", detail: "Renewal", amount: 49900, status: "paid", method: "UPI", paymentId: "pay_SAMPLE0000000009", orderNumber: "JT-001215", failureReason: null },
    { id: "s2", at: ago(6, 19), invoiceNumber: "JT/26-27/00007", kind: "ai_interview", item: "AI mock interview", detail: "30 min, Medium", amount: 59000, status: "paid", method: "Card", paymentId: "pay_SAMPLE0000000007", orderNumber: "JT-001212", failureReason: null },
    { id: "s3", at: ago(6, 18), invoiceNumber: null, kind: "ai_interview", item: "AI mock interview", detail: "30 min, Medium", amount: 59000, status: "failed", method: "Card", paymentId: "pay_SAMPLE0000000006", orderNumber: "JT-001211", failureReason: "Your bank declined the payment." },
    { id: "s4", at: ago(21), invoiceNumber: null, kind: "plan", item: "Pro plan, yearly", detail: "Upgrade", amount: 499900, status: "cancelled", method: null, paymentId: null, orderNumber: "JT-001209", failureReason: null },
    { id: "s5", at: ago(30, 9), invoiceNumber: "JT/26-27/00004", kind: "plan", item: "Pro plan, monthly", detail: "New plan", amount: 49900, status: "paid", method: "UPI", paymentId: "pay_SAMPLE0000000004", orderNumber: "JT-001203", failureReason: null },
    { id: "s6", at: ago(44, 15), invoiceNumber: null, kind: "plan", item: "Pro plan, monthly", detail: "New plan", amount: 49900, status: "pending", method: null, paymentId: null, orderNumber: "JT-001198", failureReason: null },
  ];
}
