import "server-only";

// Read side of the admin dashboard — real aggregates from the DB. Kept here so the
// page stays a thin server component. Volumes are small (admin-scale: users, résumés,
// fit scores), so time series are bucketed in JS from bounded queries rather than
// with DB date functions — clearer and driver-agnostic.
//
// Deliberately NO aggregate lead-volume analytics (total leads over time): that's
// high-volume, per-user operational data, auto-pruned on a retention schedule.
// Metrics stay user/usage/system focused.

import { desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { user, resumes, fitScores, plans, gmailSyncState } from "@/db/schema";
import type { Point } from "@/components/admin/ui/charts";
import pkg from "@/package.json";

const DAY = 86_400_000;

export interface StatCard {
  key: string;
  label: string;
  value: string;
  delta: string;
}

export interface ActivityItem {
  who: string;
  what: string;
  when: string;
}

export interface SystemRow {
  label: string;
  value: string;
  ok?: boolean;
}

export interface DashboardMetrics {
  stats: StatCard[];
  newUsers: Point[];
  aiCalls: Point[];
  planMix: Point[];
  statusMix: Point[];
  activity: ActivityItem[];
  system: SystemRow[];
}

function relativeTime(dt: Date): string {
  const secs = Math.max(0, Math.floor((Date.now() - dt.getTime()) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

const count = sql<number>`count(*)::int`;

export async function loadDashboardMetrics(): Promise<DashboardMetrics> {
  const now = Date.now();
  const monthAgo = new Date(now - 30 * DAY);
  const weekAgo = new Date(now - 7 * DAY);

  // 8-week window for the AI-calls series (bounded fetch, bucketed in JS below).
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = todayStart.getTime() + DAY;
  const aiWindowStart = new Date(todayEnd - 8 * 7 * DAY);

  const [
    totalUsersRows,
    newUsersMonthRows,
    activeUsersRows,
    signedInWeekRows,
    resumeRows,
    resumeUserRows,
    aiTotalRows,
    aiRecentRows,
    planMixRows,
    statusMixRows,
    userCreatedAt,
    aiCreatedAt,
    recentSignups,
    recentResumes,
    recentScores,
    recentSyncs,
    lastSyncRow,
  ] = await Promise.all([
    db.select({ n: count }).from(user),
    db.select({ n: count }).from(user).where(sql`${user.createdAt} >= ${monthAgo}`),
    db.select({ n: count }).from(user).where(eq(user.status, "active")),
    db.select({ n: count }).from(user).where(sql`${user.lastLoginAt} >= ${weekAgo}`),
    db.select({ n: count }).from(resumes),
    db.select({ n: sql<number>`count(distinct ${resumes.userId})::int` }).from(resumes),
    db.select({ n: count }).from(fitScores),
    db.select({ n: count }).from(fitScores).where(sql`${fitScores.createdAt} >= ${monthAgo}`),
    db
      .select({ planId: user.planId, n: count })
      .from(user)
      .groupBy(user.planId),
    db
      .select({ status: user.status, n: count })
      .from(user)
      .groupBy(user.status),
    db.select({ createdAt: user.createdAt }).from(user),
    db
      .select({ createdAt: fitScores.createdAt })
      .from(fitScores)
      .where(sql`${fitScores.createdAt} >= ${aiWindowStart}`),
    db
      .select({ name: user.name, createdAt: user.createdAt })
      .from(user)
      .orderBy(desc(user.createdAt))
      .limit(5),
    db
      .select({ name: user.name, createdAt: resumes.createdAt })
      .from(resumes)
      .innerJoin(user, eq(resumes.userId, user.id))
      .orderBy(desc(resumes.createdAt))
      .limit(5),
    db
      .select({ name: user.name, createdAt: fitScores.createdAt })
      .from(fitScores)
      .innerJoin(user, eq(fitScores.userId, user.id))
      .orderBy(desc(fitScores.createdAt))
      .limit(5),
    db
      .select({ name: user.name, syncedAt: gmailSyncState.lastSyncedAt })
      .from(gmailSyncState)
      .innerJoin(user, eq(gmailSyncState.userId, user.id))
      .where(isNotNull(gmailSyncState.lastSyncedAt))
      .orderBy(desc(gmailSyncState.lastSyncedAt))
      .limit(5),
    db
      .select({ syncedAt: gmailSyncState.lastSyncedAt })
      .from(gmailSyncState)
      .where(isNotNull(gmailSyncState.lastSyncedAt))
      .orderBy(desc(gmailSyncState.lastSyncedAt))
      .limit(1),
  ]);

  const totalUsers = totalUsersRows[0]?.n ?? 0;
  const newUsersMonth = newUsersMonthRows[0]?.n ?? 0;
  const activeUsers = activeUsersRows[0]?.n ?? 0;
  const signedInWeek = signedInWeekRows[0]?.n ?? 0;
  const resumeCount = resumeRows[0]?.n ?? 0;
  const resumeUsers = resumeUserRows[0]?.n ?? 0;
  const aiTotal = aiTotalRows[0]?.n ?? 0;
  const aiRecent = aiRecentRows[0]?.n ?? 0;

  const stats: StatCard[] = [
    {
      key: "users",
      label: "Total users",
      value: String(totalUsers),
      delta: newUsersMonth > 0 ? `+${newUsersMonth} this month` : "no new this month",
    },
    {
      key: "active",
      label: "Active users",
      value: String(activeUsers),
      delta: `${signedInWeek} signed in this week`,
    },
    {
      key: "resumes",
      label: "Résumés stored",
      value: String(resumeCount),
      delta: resumeCount > 0 ? `across ${resumeUsers} user${resumeUsers === 1 ? "" : "s"}` : "none yet",
    },
    {
      key: "ai",
      label: "AI calls (30d)",
      value: String(aiRecent),
      delta: `${aiTotal} all-time`,
    },
  ];

  // --- New users per month (last 6 months) ---
  const months: { label: string; key: string; value: number }[] = [];
  const base = new Date(todayStart);
  for (let i = 5; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    months.push({ label: d.toLocaleString("en-US", { month: "short" }), key: `${d.getFullYear()}-${d.getMonth()}`, value: 0 });
  }
  const monthIndex = new Map(months.map((m, i) => [m.key, i]));
  for (const row of userCreatedAt) {
    const d = new Date(row.createdAt);
    const idx = monthIndex.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (idx !== undefined) months[idx].value += 1;
  }
  const newUsers: Point[] = months.map((m) => ({ label: m.label, value: m.value }));

  // --- AI calls per week (last 8 weeks, bucketed by week-ending) ---
  const weeks: { label: string; start: number; end: number; value: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const end = todayEnd - i * 7 * DAY;
    const start = end - 7 * DAY;
    weeks.push({ label: new Date(start).toLocaleString("en-US", { month: "short", day: "numeric" }), start, end, value: 0 });
  }
  for (const row of aiCreatedAt) {
    const t = new Date(row.createdAt).getTime();
    const w = weeks.find((wk) => t >= wk.start && t < wk.end);
    if (w) w.value += 1;
  }
  const aiCalls: Point[] = weeks.map((w) => ({ label: w.label, value: w.value }));

  // --- Plan distribution ---
  const planNames = new Map((await db.select({ id: plans.id, name: plans.name }).from(plans)).map((p) => [p.id, p.name]));
  const planMix: Point[] = planMixRows
    .map((r) => ({ label: r.planId ? (planNames.get(r.planId) ?? "Unknown plan") : "No plan", value: r.n }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);

  // --- Status mix ---
  const statusMix: Point[] = statusMixRows
    .map((r) => ({ label: r.status === "active" ? "Active" : r.status === "inactive" ? "Inactive" : r.status, value: r.n }))
    .filter((p) => p.value > 0);

  // --- Recent activity (merge of real timestamps, newest first) ---
  type Ev = { who: string; what: string; at: number };
  const events: Ev[] = [
    ...recentSignups.map((r) => ({ who: r.name, what: "joined", at: new Date(r.createdAt).getTime() })),
    ...recentResumes.map((r) => ({ who: r.name, what: "uploaded a résumé", at: new Date(r.createdAt).getTime() })),
    ...recentScores.map((r) => ({ who: r.name, what: "scored a lead with AI", at: new Date(r.createdAt).getTime() })),
    ...recentSyncs.map((r) => ({ who: r.name, what: "completed a Gmail sync", at: new Date(r.syncedAt as Date).getTime() })),
  ];
  const activity: ActivityItem[] = events
    .sort((a, b) => b.at - a.at)
    .slice(0, 6)
    .map((e) => ({ who: e.who, what: e.what, when: relativeTime(new Date(e.at)) }));

  // --- System snapshot ---
  const appEnv = process.env.APP_ENV ?? (process.env.NODE_ENV === "production" ? "Production" : "Development");
  const lastSync = lastSyncRow[0]?.syncedAt ? relativeTime(new Date(lastSyncRow[0].syncedAt as Date)) : "Never";
  const system: SystemRow[] = [
    { label: "Environment", value: appEnv },
    { label: "App version", value: `v${pkg.version}` },
    { label: "Database", value: "Connected", ok: true },
    { label: "Last Gmail sync", value: lastSync },
  ];

  return { stats, newUsers, aiCalls, planMix, statusMix, activity, system };
}
