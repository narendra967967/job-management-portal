import "server-only";

// Razorpay over its REST API (no SDK): Basic auth with the key ID + key secret,
// JSON in and out. Signatures are HMAC-SHA256, compared in constant time.
// Docs: Standard Checkout (orders → checkout.js → verify) and Webhooks.

import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.razorpay.com/v1";
const TIMEOUT_MS = 15_000;

export interface RazorpayCreds {
  keyId: string;
  keySecret: string;
}

export class RazorpayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(creds: RazorpayCreds, path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const auth = Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64");
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    throw new RazorpayError(`Couldn't reach Razorpay (${err instanceof Error ? err.message : "network error"}).`, 0);
  }
  const data = (await res.json().catch(() => null)) as { error?: { description?: string } } | null;
  if (!res.ok) {
    throw new RazorpayError(data?.error?.description ?? `Razorpay returned ${res.status}.`, res.status);
  }
  return data as T;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string | null;
  status: "created" | "attempted" | "paid";
}

export function createOrder(
  creds: RazorpayCreds,
  input: { amount: number; currency: string; receipt: string; notes: Record<string, string> },
): Promise<RazorpayOrder> {
  return call<RazorpayOrder>(creds, "/orders", { method: "POST", body: input });
}

export interface RazorpayPayment {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method: string | null;
  error_description: string | null;
}

export function fetchPayment(creds: RazorpayCreds, paymentId: string): Promise<RazorpayPayment> {
  return call<RazorpayPayment>(creds, `/payments/${encodeURIComponent(paymentId)}`);
}

/** Capture an authorized payment (when the account doesn't auto-capture). */
export function capturePayment(
  creds: RazorpayCreds,
  paymentId: string,
  amount: number,
  currency: string,
): Promise<RazorpayPayment> {
  return call<RazorpayPayment>(creds, `/payments/${encodeURIComponent(paymentId)}/capture`, {
    method: "POST",
    body: { amount, currency },
  });
}

/** "Test connection": any authenticated read. Throws on bad keys. */
export async function ping(creds: RazorpayCreds): Promise<void> {
  await call(creds, "/orders?count=1");
}

function hmacHex(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

function sameHex(expected: string, given: string): boolean {
  if (!/^[0-9a-f]+$/i.test(given)) return false;
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(given, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Checkout success handler: signature = HMAC(order_id|payment_id, key secret). */
export function checkoutSignatureOk(keySecret: string, orderId: string, paymentId: string, signature: string): boolean {
  return sameHex(hmacHex(keySecret, `${orderId}|${paymentId}`), signature);
}

/** Webhook: X-Razorpay-Signature = HMAC(raw body, webhook secret). */
export function webhookSignatureOk(webhookSecret: string, rawBody: string, signature: string): boolean {
  return sameHex(hmacHex(webhookSecret, rawBody), signature);
}

/** Key IDs look like rzp_test_… / rzp_live_… and must match the mode. */
export const KEY_ID_RE = /^rzp_(test|live)_[A-Za-z0-9]{8,32}$/;
