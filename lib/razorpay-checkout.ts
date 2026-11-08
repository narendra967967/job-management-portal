"use client";

// Razorpay Standard Checkout in the browser: loads checkout.js on first use
// (allowed by the CSP in next.config.ts) and turns its callbacks into one
// promise. It only collects the ids + signature; the server verifies them.

const SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", cb: (resp: { error?: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let loading: Promise<boolean> | null = null;

function loadScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (loading) return loading;
  loading = new Promise<boolean>((resolve) => {
    const s = document.createElement("script");
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () => resolve(!!window.Razorpay);
    s.onerror = () => {
      loading = null; // allow a retry
      s.remove();
      resolve(false);
    };
    document.body.appendChild(s);
  });
  return loading;
}

export type CheckoutOutcome =
  | { kind: "success"; orderId: string; paymentId: string; signature: string }
  | { kind: "dismissed" }
  | { kind: "load-error" };

export async function openRazorpay(opts: {
  key: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  onFailedAttempt: (reason: string) => void;
}): Promise<CheckoutOutcome> {
  if (!(await loadScript()) || !window.Razorpay) return { kind: "load-error" };
  const Razorpay = window.Razorpay;
  return new Promise<CheckoutOutcome>((resolve) => {
    let settled = false;
    const done = (o: CheckoutOutcome) => {
      if (!settled) {
        settled = true;
        resolve(o);
      }
    };
    const rzp = new Razorpay({
      key: opts.key,
      order_id: opts.orderId,
      amount: opts.amount,
      currency: opts.currency,
      name: opts.name,
      description: opts.description,
      prefill: {
        name: opts.prefill.name,
        email: opts.prefill.email,
        ...(opts.prefill.contact ? { contact: opts.prefill.contact } : {}),
      },
      theme: { color: "#4F46E5" },
      modal: { ondismiss: () => done({ kind: "dismissed" }), confirm_close: true },
      handler: (r: RazorpaySuccess) =>
        done({ kind: "success", orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }),
    });
    rzp.on("payment.failed", (resp) => opts.onFailedAttempt(resp.error?.description ?? "Payment failed"));
    rzp.open();
  });
}
