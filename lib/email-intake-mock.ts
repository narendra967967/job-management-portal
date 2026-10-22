"use client";

// PHASE 2 ONLY — sample data for the email-forwarding screens (UI first, per
// CLAUDE.md). Replaced by real data + Server Actions in Phase 4; delete then.
//
// A tiny browser-side store so the prototype is navigable end to end: flipping
// "Connect Gmail" in the admin panel hides the Gmail tabs on the user side in
// the same browser. Persisted in localStorage; resets with "Reset sample data".

import { useSyncExternalStore } from "react";
import type {
  EmailIntakeConfig,
  ForwardingHealth,
  ForwardingStage,
  InboundLogEntry,
  InboundSender,
  MyForwarding,
  UserForwardingStatus,
} from "@/lib/email-intake-model";

interface MockState {
  config: EmailIntakeConfig;
  senders: InboundSender[];
  /** Which stage the user-side preview shows. */
  previewStage: ForwardingStage;
  addressToken: string;
}

const KEY = "jobtiva.mock.emailIntake.v1";

const DEFAULT_STATE: MockState = {
  config: {
    forwardingEnabled: true,
    gmailOAuthEnabled: true,
    maxBytes: 2 * 1024 * 1024,
    receivingDomain: "in.jobtiva.in",
    gmailToggledAt: null,
    gmailToggledBy: null,
  },
  senders: [
    { id: "s1", match: "jobalerts-noreply@linkedin.com", signingDomain: "linkedin.com", parser: "linkedin", enabled: true },
    { id: "s2", match: "jobs-noreply@linkedin.com", signingDomain: "linkedin.com", parser: "linkedin", enabled: true },
    { id: "s3", match: "jobs-listings@linkedin.com", signingDomain: "linkedin.com", parser: "linkedin", enabled: true },
  ],
  previewStage: "not_started",
  addressToken: "k7f2m9x4p3",
};

let state: MockState = DEFAULT_STATE;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<MockState>) };
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

function getSnapshot(): MockState {
  load();
  return state;
}

const getServerSnapshot = () => DEFAULT_STATE;

export function useMockIntake(): MockState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function updateMockIntake(patch: Partial<MockState>) {
  load();
  state = { ...state, ...patch };
  emit();
}

export function updateMockConfig(patch: Partial<EmailIntakeConfig>) {
  load();
  state = { ...state, config: { ...state.config, ...patch } };
  emit();
}

export function resetMockIntake() {
  state = DEFAULT_STATE;
  emit();
}

export function newMockToken(): string {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let t = "";
  for (let i = 0; i < 10; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

/* ---------------- derived sample data ---------------- */

const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export function mockMyForwarding(s: MockState): MyForwarding {
  const address = `${s.addressToken}@${s.config.receivingDomain}`;
  const base: MyForwarding = {
    address,
    gmailCode: null,
    gmailCodeAt: null,
    confirmedAt: null,
    firstReceivedAt: null,
    lastReceivedAt: null,
  };
  switch (s.previewStage) {
    case "code_received":
      return { ...base, gmailCode: "873216549", gmailCodeAt: minsAgo(2) };
    case "waiting_first_alert":
      return { ...base, confirmedAt: minsAgo(30) };
    case "working":
      return { ...base, confirmedAt: minsAgo(60 * 50), firstReceivedAt: minsAgo(60 * 48), lastReceivedAt: minsAgo(125) };
    default:
      return base;
  }
}

/** Connect Gmail connections the switch-off dialog would break (sample). */
export const MOCK_GMAIL_CONNECTED_USERS = 3;

export function mockHealth(): ForwardingHealth {
  return {
    last24h: { received: 46, accepted: 39, rejected: 7 },
    last7d: { received: 318, accepted: 281, rejected: 37 },
    topRejections: [
      { reason: "Unknown address", count: 21 },
      { reason: "Sender not allowed", count: 9 },
      { reason: "Signature check failed", count: 5 },
      { reason: "Too large", count: 2 },
    ],
    lastReceivedAt: minsAgo(4),
    usersSetUp: 7,
    usersTotal: 11,
  };
}

const SAMPLE_USERS = [
  { name: "Narendra Gupta", email: "narendra@example.com" },
  { name: "Asha Rao", email: "asha.rao@example.com" },
  { name: "Vikram Shah", email: "vikram.s@example.com" },
  { name: "Meera Iyer", email: "meera.iyer@example.com" },
];

export function mockLog(): InboundLogEntry[] {
  const rows: InboundLogEntry[] = [];
  const reasons: [InboundLogEntry["status"], string, string | null, string, string | null][] = [
    ["accepted", "3 jobs added", "jobalerts-noreply@linkedin.com", "linkedin.com", "linkedin.com"],
    ["accepted", "1 job added", "jobs-noreply@linkedin.com", "linkedin.com", "linkedin.com"],
    ["duplicate", "Already processed", "jobalerts-noreply@linkedin.com", "linkedin.com", "linkedin.com"],
    ["rejected", "Unknown address", null, "mailer.example.net", null],
    ["rejected", "Sender not allowed", null, "newsletter.shop.com", "shop.com"],
    ["gmail_code", "Confirmation code shown to user", "forwarding-noreply@google.com", "google.com", "google.com"],
    ["unsupported", "No parser for this sender", "alerts@naukri.com", "naukri.com", "naukri.com"],
    ["rejected", "Signature check failed", null, "linkedin.com", null],
    ["accepted", "5 jobs added", "jobalerts-noreply@linkedin.com", "linkedin.com", "linkedin.com"],
    ["rejected", "Too large", null, "bulk.example.org", null],
  ];
  for (let i = 0; i < 28; i++) {
    const [status, reason, fromAddress, fromDomain, signingDomain] = reasons[i % reasons.length];
    const user = status === "rejected" && reason === "Unknown address" ? null : SAMPLE_USERS[i % SAMPLE_USERS.length];
    rows.push({
      id: `log-${i}`,
      receivedAt: minsAgo(4 + i * 37),
      env: i % 6 === 5 ? "preprod" : "prod",
      user,
      fromAddress,
      fromDomain,
      signingDomain,
      status,
      reason,
      sizeBytes: 60_000 + ((i * 7919) % 90_000),
      leadsCreated: status === "accepted" ? Number(reason[0]) || 1 : 0,
    });
  }
  return rows;
}

/** Deterministic per-user sample status for the admin Users screen. */
export function mockUserForwarding(userId: string): UserForwardingStatus {
  let h = 0;
  for (const c of userId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const stage = h % 4;
  return {
    addressCreatedAt: stage >= 1 ? minsAgo(60 * 24 * (3 + (h % 9))) : null,
    confirmedAt: stage >= 2 ? minsAgo(60 * 24 * (2 + (h % 5))) : null,
    firstReceivedAt: stage >= 3 ? minsAgo(60 * 24 * (1 + (h % 4))) : null,
    lastReceivedAt: stage >= 3 ? minsAgo(30 + (h % 600)) : null,
  };
}
