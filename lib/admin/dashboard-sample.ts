// PHASE 1 ONLY: made-up dashboard figures so the screens can be reviewed before
// any real data is wired (docs/admin-dashboard/spec.md). Phase 3 replaces this
// with lib/admin/dashboard-data.ts and this file is deleted.
//
// Deterministic: the same period always shows the same numbers. `quiet` shows
// a day with nothing needing attention, to review the "All clear" state.

import type { Point } from "@/components/admin/ui/charts";
import {
  FUNNEL_STEPS,
  links,
  periodRange,
  type AttentionItem,
  type DashboardData,
  type PeriodSel,
  type TimeSeries,
} from "@/lib/admin/dashboard-model";

const DAY = 86_400_000;
const HOUR = 3_600_000;

// Small seeded generator so numbers look varied but never change between loads.
function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function series(now: Date, base: number, growth: number, rand: () => number): TimeSeries {
  const daily: Point[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY);
    daily.push({
      label: d.toLocaleString("en-US", { month: "short", day: "numeric" }),
      value: Math.max(0, Math.round(base + rand() * base * 1.4 - base * 0.5)),
    });
  }
  const monthly: Point[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthly.push({
      label: d.toLocaleString("en-US", { month: "short" }),
      value: Math.max(0, Math.round(base * 30 * Math.pow(growth, 11 - i) * 0.35 + rand() * base * 8)),
    });
  }
  const yearly: Point[] = [];
  for (let i = 4; i >= 0; i--) {
    yearly.push({ label: String(now.getFullYear() - i), value: i > 1 ? 0 : Math.round(base * 300 * (i === 0 ? 1 : 0.3)) });
  }
  return { daily, monthly, yearly };
}

const iso = (ms: number) => new Date(ms).toISOString();

export function sampleDashboard(sel: PeriodSel, quiet = false): DashboardData {
  const now = new Date();
  const t = now.getTime();
  const { days } = periodRange(sel, now);
  const r = rng(days * 7919 + (sel.id === "custom" ? 13 : sel.id.length * 101));
  const scale = Math.max(days, 1) / 30;

  const joined = Math.round(46 * scale + r() * 6);
  const total = 1284;
  const paidCount = 212;
  const revenueTotal = Math.round((182_400 * scale + r() * 20_000) / 100) * 10_000; // paise
  const unpaid = quiet ? 0 : 3;
  const failed = quiet ? 0 : 2;

  const attention: AttentionItem[] = quiet
    ? []
    : [
        { key: "tickets-waiting", severity: "critical", count: 3, text: "3 tickets waiting more than 24 hours", href: links.tickets({ status: "unresolved", waitingHours: 24 }) },
        { key: "failed-payments", severity: "critical", count: failed, text: `${failed} payments failed in the last 7 days`, href: links.orders({ status: "failed" }) },
        { key: "expired-plans", severity: "warning", count: 4, text: "4 paid plans expired in the last 7 days without renewal", href: links.renewals({ due: "ended" }) },
        { key: "deletion-requests", severity: "warning", count: 1, text: "1 account deletion request", href: links.tickets({ status: "open" }) },
        { key: "ai-queue", severity: "warning", count: 12, text: "12 job alerts waiting in the AI reading queue for over an hour", href: links.inbound({ status: "queued" }) },
        { key: "broadcast-failed", severity: "info", count: 6, text: "6 emails failed in the last broadcast", href: links.broadcasts({ id: "sample-broadcast" }) },
        { key: "kb-unanswered", severity: "info", count: 5, text: "5 unanswered knowledge base questions", href: links.kbUnanswered() },
        { key: "ses-sandbox", severity: "info", count: 1, text: "Amazon SES is still in the sandbox", href: links.settings("email") },
        { key: "deactivated", severity: "info", count: 2, text: "2 accounts deactivated this period", href: links.users({ status: "inactive" }) },
      ];

  const newUsers = series(now, 1.6, 1.12, r);
  const newPaid: TimeSeries = {
    daily: newUsers.daily.map((p) => ({ ...p, value: Math.round(p.value * 0.22) })),
    monthly: newUsers.monthly.map((p) => ({ ...p, value: Math.round(p.value * 0.18) })),
    yearly: newUsers.yearly.map((p) => ({ ...p, value: Math.round(p.value * 0.17) })),
  };

  return {
    generatedAt: now.toISOString(),
    attention,
    users: { total, joined, joinedPrev: Math.round(joined * 0.84) },
    signedIn: { count: Math.min(total, Math.round(380 * Math.min(scale, 3) ** 0.5 + r() * 20)), prev: Math.round(352 * Math.min(scale, 3) ** 0.5) },
    paid: { count: paidCount, conversionPct: 17, prevConversionPct: 15 },
    revenue: {
      total: revenueTotal,
      prev: Math.round(revenueTotal * 0.88),
      orders: Math.round(31 * scale + 2),
      byMonth: newUsers.monthly.map((p, i) => ({ label: p.label, value: Math.round((40_000 + i * 14_000 + r() * 12_000) / 100) * 10_000 })),
      byPlan: [
        { label: "Pro", value: Math.round(revenueTotal * 0.78) },
        { label: "Starter", value: Math.round(revenueTotal * 0.22) },
      ],
      currency: "INR",
    },
    incompleteOrders: { unpaid, failed, lastFailedAt: failed ? iso(t - 5 * HOUR) : null },
    newUsers,
    newPaidUsers: newPaid,
    activeUsers: series(now, 120, 1.08, r),
    planMix: [
      { label: "Free", value: 1004, plan: "free" },
      { label: "Pro", value: 168, plan: "pro" },
      { label: "Starter", value: 44, plan: "starter" },
      { label: "Expired", value: 68, plan: "expired" },
    ],
    funnel: FUNNEL_STEPS.map((s, i) => ({ ...s, value: Math.round(joined * [1, 0.91, 0.62, 0.41, 0.37, 0.3, 0.17][i]) })),
    support: {
      open: quiet ? 1 : 5,
      inProgress: quiet ? 0 : 3,
      oldestOpenMs: quiet ? 2 * HOUR : 3.2 * DAY,
      avgFirstResponseMs: 5.5 * HOUR,
      avgResolutionMs: 1.6 * DAY,
      waiting: quiet
        ? [{ id: "t9", number: 241, subject: "How do I change my billing email?", who: "Ananya Rao", status: "open", waitingMs: 2 * HOUR }]
        : [
            { id: "t1", number: 212, subject: "Job alerts stopped arriving", who: "Rahul Mehta", status: "open", waitingMs: 3.2 * DAY },
            { id: "t2", number: 219, subject: "Charged twice for Pro yearly", who: "Priya Nair", status: "in_progress", waitingMs: 2.1 * DAY },
            { id: "t3", number: 225, subject: "Please delete my account", who: "Karan Shah", status: "open", waitingMs: 30 * HOUR },
            { id: "t4", number: 231, subject: "Résumé upload fails on phone", who: "Meera Iyer", status: "in_progress", waitingMs: 9 * HOUR },
            { id: "t5", number: 236, subject: "Can I pause my plan?", who: "Arjun Das", status: "open", waitingMs: 3 * HOUR },
          ],
    },
    renewals: {
      due7: 9,
      due30: 31,
      expired30: quiet ? 0 : 14,
      next: [
        { userId: "u1", name: "Sneha Kulkarni", plan: "Pro monthly", endsAt: iso(t + 0.6 * DAY) },
        { userId: "u2", name: "Vikram Joshi", plan: "Pro yearly", endsAt: iso(t + 1.4 * DAY) },
        { userId: "u3", name: "Fatima Khan", plan: "Starter monthly", endsAt: iso(t + 2.8 * DAY) },
        { userId: "u4", name: "Rohan Gupta", plan: "Pro monthly", endsAt: iso(t + 4.1 * DAY) },
        { userId: "u5", name: "Divya Menon", plan: "Pro monthly", endsAt: iso(t + 6.5 * DAY) },
      ],
    },
    forwarding: {
      enabled: true,
      usersSetUp: 796,
      usersTotal: total,
      received: Math.round(2_140 * scale),
      rejected: Math.round(46 * scale),
      acceptedPct: 97,
      lastReceivedAt: iso(t - 4 * 60_000),
      topRejections: quiet
        ? []
        : [
            { reason: "Signature check failed", count: Math.round(21 * scale) + 1 },
            { reason: "Sender not allowed", count: Math.round(14 * scale) + 1 },
            { reason: "Unknown address", count: Math.round(11 * scale) + 1 },
          ],
    },
    emailDelivery: {
      provider: "ses",
      ready: true,
      sesSandbox: !quiet,
      sesQuota: { used: 64, max: 200 },
      sent: Math.round(3_420 * scale),
      failed: quiet ? 0 : Math.round(9 * scale) + 1,
      byChannel: [
        { channel: "Amazon SES", sent: Math.round(3_180 * scale), failed: quiet ? 0 : Math.round(7 * scale) + 1 },
        { channel: "SMTP", sent: Math.round(240 * scale), failed: quiet ? 0 : Math.round(2 * scale) },
      ],
    },
    broadcasts: {
      next: { id: "b3", title: "New: Naukri alerts now supported", at: iso(t + 1.5 * DAY), total: 1196, delivered: 0, failed: 0 },
      sending: quiet ? null : { id: "b2", title: "November tips for your job search", at: iso(t - 0.3 * HOUR), total: 1180, delivered: 742, failed: 3 },
      last: { id: "sample-broadcast", title: "Plan prices from December", at: iso(t - 6 * DAY), total: 1162, delivered: 1156, failed: quiet ? 0 : 6 },
    },
    // Shown on the busy day only, so the block can be reviewed (it appears only while Gmail sign-in sync is on).
    gmail: { enabled: !quiet, connected: 38, totalUsers: total, lastSyncAt: quiet ? null : iso(t - 25 * 60_000), ingestErrors: 2, failingSyncs: 1 },
    system: {
      environment: "Preprod",
      commit: "e631082",
      dbSizeBytes: 412 * 1024 * 1024,
      diskBytes: 20 * 1024 * 1024 * 1024,
      resumeBytes: 186 * 1024 * 1024,
      resumeFiles: 1_042,
      assetBytes: 3.4 * 1024 * 1024,
      jobs: [
        { key: "inbound-ai", label: "Job-alert reading", lastRunAt: iso(t - 2 * 60_000), ok: true },
        { key: "broadcasts", label: "Broadcast sending", lastRunAt: iso(t - 3 * 60_000), ok: true },
        { key: "reminders", label: "Plan reminders", lastRunAt: iso(t - 9 * HOUR), ok: quiet ? true : false, error: quiet ? undefined : "SMTP isn't set up" },
        { key: "retention", label: "Data retention", lastRunAt: iso(t - 9 * HOUR), ok: true },
        { key: "lead-purge", label: "Lead clean-up", lastRunAt: iso(t - 9 * HOUR), ok: true },
      ],
    },
  };
}
