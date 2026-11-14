// Admin dashboard: shapes, periods, block registry and filtered links. Client-safe.
// Scope: docs/admin-dashboard/spec.md. The page fills a DashboardData from
// lib/admin/dashboard-data.ts (counted in the database).

import type { Point } from "@/components/admin/ui/charts";
import type { EmailProvider } from "@/lib/email-delivery-model";

/* ---------------- period ---------------- */

export const PERIODS = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "custom", label: "Custom" },
] as const;

export type PeriodId = (typeof PERIODS)[number]["id"];
export const DEFAULT_PERIOD: PeriodId = "30d";
/** Remembers the last period per browser; holds "period=…&from=…&to=". */
export const PERIOD_COOKIE = "jobtiva_admin_period";

export interface PeriodSel {
  id: PeriodId;
  /** YYYY-MM-DD, only for "custom". */
  from?: string;
  to?: string;
}

const DAY = 86_400_000;

export function isPeriodId(v: unknown): v is PeriodId {
  return PERIODS.some((p) => p.id === v);
}

/** YYYY-MM-DD in the viewer's local time. */
export function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse ?period=&from=&to= into a selection, falling back to the default. */
export function parsePeriod(sp: { period?: string; from?: string; to?: string }): PeriodSel {
  const id = isPeriodId(sp.period) ? sp.period : DEFAULT_PERIOD;
  if (id !== "custom") return { id };
  const from = sp.from && DATE_RE.test(sp.from) ? sp.from : undefined;
  const to = sp.to && DATE_RE.test(sp.to) ? sp.to : undefined;
  if (!from || !to || from > to) return { id: DEFAULT_PERIOD };
  return { id, from, to };
}

/** A YYYY-MM-DD date moved by n days (calendar maths, no time zone involved). */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Today's date (YYYY-MM-DD) in an IANA time zone. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export interface DayRange {
  from: string;
  to: string;
  days: number;
}

/**
 * First and last day (inclusive) of a selection. `today` is the viewer's date:
 * the browser passes its own; the server passes todayIn(the viewer's zone).
 */
export function periodRange(sel: PeriodSel, today = ymd(new Date())): DayRange {
  const span = (from: string, to: string): DayRange => ({
    from,
    to,
    days: Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1),
  });
  const firstOfMonth = `${today.slice(0, 8)}01`;
  switch (sel.id) {
    case "today":
      return span(today, today);
    case "7d":
      return span(addDays(today, -6), today);
    case "30d":
      return span(addDays(today, -29), today);
    case "90d":
      return span(addDays(today, -89), today);
    case "month":
      return span(firstOfMonth, today);
    case "last-month": {
      const end = addDays(firstOfMonth, -1);
      return span(`${end.slice(0, 8)}01`, end);
    }
    case "custom":
      return span(sel.from ?? today, sel.to ?? today);
  }
}

/** The same number of days just before a range, for "vs previous period". */
export function previousRange(r: DayRange): DayRange {
  return { from: addDays(r.from, -r.days), to: addDays(r.from, -1), days: r.days };
}

/** Holds the viewer's IANA time zone so the server counts days the way they see them. */
export const TZ_COOKIE = "jobtiva_admin_tz";
/** Used until the browser has told us its zone (the app's quiet-hours default). */
export const DEFAULT_TZ = "Asia/Kolkata";

export function isTimeZone(v: unknown): v is string {
  if (typeof v !== "string" || v.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}

/** "Last 30 days" or "Oct 1 – Oct 14, 2026" for custom. */
export function periodLabel(sel: PeriodSel): string {
  if (sel.id !== "custom") return PERIODS.find((p) => p.id === sel.id)!.label;
  const f = (s?: string) =>
    s ? new Date(`${s}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  return `${f(sel.from)} to ${f(sel.to)}`;
}

/* ---------------- links ---------------- */

const q = (params: Record<string, string | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) s.set(k, v);
  const str = s.toString();
  return str ? `?${str}` : "";
};

/**
 * Where each number leads. The target pages read these filters from the link in
 * phase 2; until then they open unfiltered.
 */
export const links = {
  /**
   * plan: a plan id, "paid" or "free". expiry: "soon", "expired" or "none". step: a FUNNEL_STEPS key.
   * Always customers only (role=user), like every number on the dashboard.
   */
  users: (
    f: { joinedFrom?: string; joinedTo?: string; signedInFrom?: string; signedInTo?: string; plan?: string; expiry?: string; step?: FunnelKey; status?: string } = {},
  ) =>
    `/jmp-admin/users${q({
      role: "user",
      joinedFrom: f.joinedFrom,
      joinedTo: f.joinedTo,
      signedInFrom: f.signedInFrom,
      signedInTo: f.signedInTo,
      plan: f.plan,
      expiry: f.expiry,
      step: f.step,
      status: f.status,
    })}`,
  /** status: open, in_progress, resolved or unresolved. waitingHours: unresolved and older than this. */
  tickets: (f: { status?: string; waitingHours?: number; open?: string } = {}) =>
    `/jmp-admin/tickets${q({ status: f.status, waiting: f.waitingHours ? String(f.waitingHours) : undefined, open: f.open })}`,
  /** status: paid, failed, created, cancelled or unfinished (created + failed). plan: plan name. mode: live or test. */
  orders: (f: { status?: string; from?: string; to?: string; plan?: string; mode?: string } = {}) =>
    `/jmp-admin/orders${q({ status: f.status, from: f.from, to: f.to, plan: f.plan, mode: f.mode })}`,
  /** due: 7, 30 or 90 days ahead, "ended30" (ended in the last 30 days) or "ended" (last 90). */
  renewals: (f: { due?: "7" | "30" | "90" | "ended30" | "ended" } = {}) => `/jmp-admin/renewals${q({ due: f.due })}`,
  broadcasts: (f: { status?: string; id?: string } = {}) =>
    f.id ? `/jmp-admin/broadcasts/${f.id}` : `/jmp-admin/broadcasts${q({ status: f.status })}`,
  inbound: (f: { status?: string; from?: string; to?: string } = {}) =>
    `/jmp-admin/inbound-log${q({ status: f.status, from: f.from, to: f.to })}`,
  kbUnanswered: () => "/jmp-admin/knowledge-base/unanswered",
  settings: (section: string) => `/jmp-admin/settings${q({ section })}`,
  /** status: sent or failed. channel: as stored, e.g. "Amazon SES". kind: template, broadcast or test. */
  sentEmails: (f: { status?: string; channel?: string; kind?: string; from?: string; to?: string } = {}) =>
    `/jmp-admin/sent-emails${q({ status: f.status, channel: f.channel, kind: f.kind, from: f.from, to: f.to })}`,
};

/* ---------------- onboarding funnel ---------------- */

export const FUNNEL_STEPS = [
  { key: "signed-up", label: "Signed up" },
  { key: "verified", label: "Verified email" },
  { key: "forwarding", label: "Set up forwarding" },
  { key: "ai-key", label: "Added AI key" },
  { key: "resume", label: "Added a résumé" },
  { key: "leads", label: "Saved 5+ leads" },
  { key: "paid", label: "Paid" },
] as const;

export type FunnelKey = (typeof FUNNEL_STEPS)[number]["key"];

/** What the funnel needs to know about one user. */
export interface FunnelFacts {
  emailVerified: boolean;
  /** At least one forwarded job alert arrived. */
  forwardingReceived: boolean;
  hasAiKey: boolean;
  hasResume: boolean;
  leads: number;
  /** On a paid plan (expired or not counts: they did pay). */
  paid: boolean;
}

export function isFunnelKey(v: unknown): v is FunnelKey {
  return FUNNEL_STEPS.some((s) => s.key === v);
}

export function reachedStep(key: FunnelKey, f: FunnelFacts): boolean {
  switch (key) {
    case "signed-up":
      return true;
    case "verified":
      return f.emailVerified;
    case "forwarding":
      return f.forwardingReceived;
    case "ai-key":
      return f.hasAiKey;
    case "resume":
      return f.hasResume;
    case "leads":
      return f.leads >= 5;
    case "paid":
      return f.paid;
  }
}

/** Reached this step but not the next one (the last step: reached it). */
export function stoppedAt(key: FunnelKey, f: FunnelFacts): boolean {
  const i = FUNNEL_STEPS.findIndex((s) => s.key === key);
  const next = FUNNEL_STEPS[i + 1];
  return reachedStep(key, f) && (!next || !reachedStep(next.key, f));
}

export function funnelLabel(key: FunnelKey): string {
  return FUNNEL_STEPS.find((s) => s.key === key)!.label;
}

/* ---------------- block registry (order + size; phase 6 makes it editable) ---------------- */

export type BlockSize = "tile" | "third" | "half" | "wide" | "full";

export const BLOCKS = [
  { id: "tile-users", title: "Total users", size: "tile" },
  { id: "tile-signed-in", title: "Signed in", size: "tile" },
  { id: "tile-paid", title: "Paid users", size: "tile" },
  { id: "tile-revenue", title: "Revenue", size: "tile" },
  { id: "new-users", title: "New users", size: "wide" },
  { id: "plans", title: "Plan distribution", size: "third" },
  { id: "revenue", title: "Revenue", size: "wide" },
  { id: "incomplete-orders", title: "Unfinished orders", size: "third" },
  { id: "active-users", title: "Active users", size: "half" },
  { id: "funnel", title: "Onboarding funnel", size: "half" },
  { id: "support", title: "Support", size: "wide" },
  { id: "renewals", title: "Renewals", size: "third" },
  { id: "forwarding", title: "Forwarding health", size: "third" },
  { id: "email-delivery", title: "Email delivery", size: "third" },
  { id: "broadcasts", title: "Broadcasts", size: "third" },
  { id: "gmail", title: "Gmail health", size: "third" },
  { id: "system", title: "System", size: "full" },
] as const satisfies readonly { id: string; title: string; size: BlockSize }[];

export type BlockId = (typeof BLOCKS)[number]["id"];

/** A block name that is unique on the page (tiles share titles with bigger blocks). */
export function blockLabel(id: BlockId): string {
  const title = BLOCKS.find((b) => b.id === id)!.title;
  return id.startsWith("tile-") ? `${title} tile` : title;
}

/* ---------------- layout (order + hidden blocks) ---------------- */

export interface DashboardLayout {
  order: BlockId[];
  hidden: BlockId[];
}

/**
 * Where the layout is kept until phase 6 moves it to the database (per admin).
 * Holds "o=id,id,…&h=id,id".
 */
export const LAYOUT_COOKIE = "jobtiva_admin_layout";

export function defaultLayout(): DashboardLayout {
  return { order: BLOCKS.map((b) => b.id), hidden: [] };
}

function isBlockId(v: string): v is BlockId {
  return BLOCKS.some((b) => b.id === v);
}

/**
 * Clean up a saved layout: drop ids that no longer exist, and put blocks added
 * since it was saved back in their default place.
 */
export function normalizeLayout(l: { order: string[]; hidden: string[] }): DashboardLayout {
  const order = [...new Set(l.order.filter(isBlockId))];
  const ids = BLOCKS.map((b) => b.id);
  ids.forEach((id, i) => {
    if (order.includes(id)) return;
    // Insert after the nearest earlier default neighbour that's already placed.
    const before = ids.slice(0, i).reverse().find((x) => order.includes(x));
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, id);
  });
  return { order, hidden: [...new Set(l.hidden.filter(isBlockId))] };
}

export function parseLayout(value: string | undefined | null): DashboardLayout {
  if (!value) return defaultLayout();
  const sp = new URLSearchParams(value);
  const list = (k: string) => (sp.get(k) ?? "").split(",").filter(Boolean);
  return normalizeLayout({ order: list("o"), hidden: list("h") });
}

export function serializeLayout(l: DashboardLayout): string {
  return new URLSearchParams({ o: l.order.join(","), h: l.hidden.join(",") }).toString();
}

export function isDefaultLayout(l: DashboardLayout): boolean {
  const d = defaultLayout();
  return l.hidden.length === 0 && l.order.join() === d.order.join();
}

/* ---------------- data ---------------- */

export interface TimeSeries {
  daily: Point[];
  monthly: Point[];
  yearly: Point[];
}

export type Severity = "critical" | "warning" | "info";

export interface AttentionItem {
  key: string;
  severity: Severity;
  count: number;
  /** Plain sentence, e.g. "3 tickets waiting more than 24 hours". */
  text: string;
  href: string;
}

export interface Delta {
  /** Value in the previous period of the same length; null when there's none. */
  previous: number | null;
}

export interface FunnelStep {
  key: FunnelKey;
  label: string;
  /** People who reached this step. */
  value: number;
  /** Of those, how many didn't reach the next one (what the Users link lists). */
  stopped: number;
}

export interface WaitingTicket {
  id: string;
  number: number;
  subject: string;
  who: string;
  status: "open" | "in_progress";
  /** Milliseconds since it was opened. */
  waitingMs: number;
}

export interface RenewalRow {
  userId: string;
  name: string;
  plan: string;
  /** ISO date the plan ends. */
  endsAt: string;
}

export interface BroadcastSummary {
  id: string;
  title: string;
  /** ISO time it's scheduled for, or when it finished sending. */
  at: string;
  total: number;
  delivered: number;
  failed: number;
}

export interface JobRun {
  key: string;
  label: string;
  /** How often the crontab runs it, as shown. */
  every: string;
  /** ISO time the last run finished, null when it hasn't run yet. */
  lastRunAt: string | null;
  ok: boolean | null;
  error?: string;
  /** Failed runs since the last good one. */
  failuresInARow: number;
  /** Should have run again by now. */
  late: boolean;
}

export interface DashboardData {
  generatedAt: string;
  attention: AttentionItem[];
  users: { total: number; joined: number; joinedPrev: number | null };
  signedIn: { count: number; prev: number | null };
  paid: { count: number; conversionPct: number; prevConversionPct: number | null };
  revenue: {
    /** All amounts in paise, net of GST, live orders only. */
    total: number;
    prev: number | null;
    orders: number;
    byMonth: Point[];
    byPlan: Point[];
    currency: string;
  };
  incompleteOrders: { unpaid: number; failed: number; lastFailedAt: string | null };
  newUsers: TimeSeries;
  newPaidUsers: TimeSeries;
  activeUsers: TimeSeries;
  /** plan: a plan id, "free" (free plans and no plan) or "expired" (a paid plan that ended). */
  planMix: (Point & { plan: string })[];
  funnel: FunnelStep[];
  support: {
    open: number;
    inProgress: number;
    oldestOpenMs: number | null;
    avgFirstResponseMs: number | null;
    avgResolutionMs: number | null;
    waiting: WaitingTicket[];
  };
  renewals: { due7: number; due30: number; expired30: number; next: RenewalRow[] };
  forwarding: {
    enabled: boolean;
    usersSetUp: number;
    usersTotal: number;
    received: number;
    rejected: number;
    acceptedPct: number;
    lastReceivedAt: string | null;
    topRejections: { reason: string; count: number }[];
  };
  emailDelivery: {
    provider: EmailProvider;
    ready: boolean;
    sesSandbox: boolean | null;
    sesQuota: { used: number; max: number } | null;
    /** From the sent-email log, for the period: every email handed to a channel. */
    log: { sent: number; failed: number; byChannel: { channel: string; sent: number; failed: number }[] };
  };
  broadcasts: { next: BroadcastSummary | null; sending: BroadcastSummary | null; last: BroadcastSummary | null };
  gmail: { enabled: boolean; connected: number; totalUsers: number; lastSyncAt: string | null; ingestErrors: number; failingSyncs: number };
  system: {
    environment: string;
    commit: string | null;
    dbSizeBytes: number;
    diskBytes: number | null;
    resumeBytes: number;
    resumeFiles: number;
    assetBytes: number;
    /** Last run of each scheduled job, in lib/job-runs-model.ts order. */
    jobs: JobRun[];
  };
}

/** The date range behind one bar or point of a time series (index from the left). */
export function bucketRange(g: "daily" | "monthly" | "yearly", index: number, length: number, now = new Date()): { from: string; to: string } {
  const back = length - 1 - index;
  if (g === "daily") {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    return { from: ymd(d), to: ymd(d) };
  }
  if (g === "monthly") {
    return {
      from: ymd(new Date(now.getFullYear(), now.getMonth() - back, 1)),
      to: ymd(new Date(now.getFullYear(), now.getMonth() - back + 1, 0)),
    };
  }
  const y = now.getFullYear() - back;
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

/* ---------------- formatting ---------------- */

/** ₹ with Indian grouping, from paise. */
export function formatMoney(paise: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(paise / 100);
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-IN");
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "None yet";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${Math.max(mins, 1)} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} h`;
  return `${Math.round(hrs / 24)} days`;
}

/** "in 14 h" or "in 3 days" until an ISO time; "now" once it's passed. */
export function timeUntil(iso: string, now = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "now";
  return `in ${formatDuration(ms)}`;
}

/** "+12% vs previous period", or null when there's nothing to compare. */
export function changeText(now: number, prev: number | null): { text: string; up: boolean } | null {
  if (prev === null) return null;
  if (prev === 0) return now === 0 ? { text: "Same as previous period", up: true } : { text: "New this period", up: true };
  const pct = Math.round(((now - prev) / prev) * 100);
  if (pct === 0) return { text: "Same as previous period", up: true };
  return { text: `${pct > 0 ? "+" : ""}${pct}% vs previous period`, up: pct > 0 };
}
