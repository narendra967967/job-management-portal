"use client";

// PHASE 1 ONLY — sample data for the payments screens (UI first, per
// CLAUDE.md). Replaced by real data + Server Actions in Phase 3; delete then.
//
// A small browser-side store so the prototype is navigable end to end: turning
// Razorpay on in admin Settings → Payments switches the user's checkout from
// "Request this plan" to "Pay", in the same browser. Also holds two preview
// switches: limited mode (as if the plan had expired) and the result a test
// payment returns. Persisted in localStorage; "Reset" restores the defaults.

import { useSyncExternalStore } from "react";
import type { AdminOrderRow, GatewaySettings } from "@/lib/billing-model";

export type PreviewOutcome = "paid" | "cancelled" | "failed";

interface MockPayments {
  razorpay: GatewaySettings;
  previewLimited: boolean;
  previewOutcome: PreviewOutcome;
}

const KEY = "jobtiva.mock.payments.v1";

const DEFAULT_STATE: MockPayments = {
  razorpay: {
    id: "razorpay",
    enabled: false,
    mode: "test",
    keyId: "",
    hasKeySecret: false,
    hasWebhookSecret: false,
    lastTestOk: null,
    lastTestAt: null,
  },
  previewLimited: false,
  previewOutcome: "paid",
};

let state: MockPayments = DEFAULT_STATE;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<MockPayments>) };
  } catch {
    /* private mode / blocked storage — keep defaults */
  }
}

function emit() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    loaded = false;
    load();
    l();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): MockPayments {
  load();
  return state;
}

const getServerSnapshot = () => DEFAULT_STATE;

export function useMockPayments(): MockPayments {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function updateMockPayments(patch: Partial<MockPayments>) {
  load();
  state = { ...state, ...patch };
  emit();
}

export function updateMockGateway(patch: Partial<GatewaySettings>) {
  load();
  state = { ...state, razorpay: { ...state.razorpay, ...patch } };
  emit();
}

export function resetMockPayments() {
  state = DEFAULT_STATE;
  emit();
}

/* ---------------- derived sample data ---------------- */

const daysAgo = (d: number, h = 0) => new Date(Date.now() - d * 86_400_000 - h * 3_600_000).toISOString();

const SAMPLE_USERS = [
  { name: "Asha Rao", email: "asha.rao@example.com" },
  { name: "Vikram Shah", email: "vikram.s@example.com" },
  { name: "Meera Iyer", email: "meera.iyer@example.com" },
  { name: "Rohan Mehta", email: "rohan.m@example.com" },
];

export function mockOrders(): AdminOrderRow[] {
  const shapes: Pick<AdminOrderRow, "planName" | "period" | "kind" | "total" | "status" | "failureReason">[] = [
    { planName: "Premium", period: "monthly", kind: "new", total: 58_882, status: "paid", failureReason: null },
    { planName: "Pro", period: "yearly", kind: "upgrade", total: 588_882, status: "paid", failureReason: null },
    { planName: "Premium", period: "monthly", kind: "renew", total: 58_882, status: "paid", failureReason: null },
    { planName: "Pro", period: "monthly", kind: "upgrade", total: 117_882, status: "failed", failureReason: "Payment declined by the bank" },
    { planName: "Premium", period: "yearly", kind: "new", total: 588_882, status: "cancelled", failureReason: "Closed the payment window" },
    { planName: "Premium", period: "monthly", kind: "new", total: 58_882, status: "created", failureReason: null },
  ];
  // ~40 orders over the last 45 days, so the 7-day default and date filters show something.
  return Array.from({ length: 40 }, (_, i) => {
    const s = shapes[(i * 7) % shapes.length];
    const createdAt = daysAgo(Math.floor(i * 1.1), (i * 5) % 24);
    const base = Math.round((s.total * 100) / 118);
    const end = new Date(createdAt);
    if (s.period === "monthly") end.setMonth(end.getMonth() + 1);
    else end.setFullYear(end.getFullYear() + 1);
    const creditDays = s.kind === "upgrade" ? 9 : 0;
    end.setDate(end.getDate() + creditDays);
    return {
      id: `order-${i}`,
      createdAt,
      paidAt: s.status === "paid" ? new Date(new Date(createdAt).getTime() + 90_000).toISOString() : null,
      user: SAMPLE_USERS[i % SAMPLE_USERS.length],
      ...s,
      base,
      tax: s.total - base,
      taxRate: 18,
      currency: "INR",
      startsAt: createdAt,
      expiresAt: end.toISOString(),
      creditDays,
      method: s.status === "paid" || s.status === "failed" ? ["UPI", "Card", "Netbanking", "Wallet"][i % 4] : null,
      receipt: `JOB-${String(1200 + i).padStart(6, "0")}`,
      gateway: "razorpay",
      mode: "test",
      gatewayOrderId: `order_SAMPLE${String(1000 + i)}`,
      gatewayPaymentId: s.status === "paid" ? `pay_SAMPLE${String(5000 + i)}` : null,
    };
  });
}
