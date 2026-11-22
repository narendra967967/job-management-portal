// User Orders & payments page (/orders, docs/invoices/spec.md, section 7): one row per
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
