import "server-only";

// Read side of the admin dashboard — real aggregates from the DB. Kept here so the
// page stays a thin server component. Volumes are small (admin-scale: users, résumés,
// fit scores), so time series are bucketed in JS from bounded queries rather than
// with DB date functions — clearer and driver-agnostic.
//
// User-base metrics count ONLY role='user' accounts — admins are operators, not
// customers, so they're excluded from totals, plan/status mixes, funnel, and the feed.
//
// Deliberately NO aggregate lead-volume analytics (total leads over time): that's
// high-volume, per-user operational data, auto-pruned on a retention schedule.
// Metrics stay user/usage/system focused.

import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  user,
  session,
  resumes,
  resumeFiles,
  appAssets,
  fitScores,
  plans,
  gmailConfig,
  gmailSyncState,
  gmailIngestErrors,
  supportTickets,
  ticketReplies,
} from "@/db/schema";
import type { Point } from "@/components/admin/ui/charts";
import pkg from "@/package.json";

const DAY = 86_400_000;

export type Granularity = "daily" | "monthly" | "yearly";
export interface TimeSeries {
  daily: Point[];
  monthly: Point[];
  yearly: Point[];
}

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

export interface RecentTicket {
  id: string;
  subject: string;
  who: string;
  status: "open" | "in_progress" | "resolved";
  when: string;
}

export interface TicketStats {
  total: number;
  open: number;
  statusMix: Point[];
}

export interface SlaStats {
  firstResponse: string;
  resolution: string;
  openCount: number;
  oldestOpen: string;
  resolutionRate: number;
}

export interface FunnelStage {
  label: string;
  value: number;
  pct: number;
}

export interface GmailHealth {
  connected: number;
  totalUsers: number;
  lastSync: string;
  ingestErrors: number;
  failingSyncs: number;
}

export interface StorageStats {
  resumeFiles: number;
  resumeSize: string;
  assetSize: string;
  total: string;
}

export interface PlanExpiryAlert {
  name: string;
  plan: string;
  when: string;
  expired: boolean;
  soon: boolean;
}

export interface PlanExpiry {
  expired: number;
  soon7: number;
  soon30: number;
  alerts: PlanExpiryAlert[];
}

export interface DashboardMetrics {
  stats: StatCard[];
  newUsers: TimeSeries;
  aiScores: TimeSeries;
  activeUsers: TimeSeries;
  planMix: Point[];
  statusMix: Point[];
  funnel: FunnelStage[];
  gmail: GmailHealth;
  storage: StorageStats;
  planExpiry: PlanExpiry;
  ticketStats: TicketStats;
  recentTickets: RecentTicket[];
  sla: SlaStats;
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

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function humanDuration(ms: number): string {
  if (ms <= 0) return "0m";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

// Fixed bucket windows for the three granularities (last 30 days / 12 months / 5 years).
function buildBuckets(g: Granularity, now: Date): { label: string; start: number; end: number }[] {
  const out: { label: string; start: number; end: number }[] = [];
  if (g === "daily") {
    const base = new Date(now);
    base.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const s = d.getTime();
      out.push({ label: d.toLocaleString("en-US", { month: "short", day: "numeric" }), start: s, end: s + DAY });
    }
  } else if (g === "monthly") {
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      out.push({ label: start.toLocaleString("en-US", { month: "short" }), start: start.getTime(), end: end.getTime() });
    }
  } else {
    for (let i = 4; i >= 0; i--) {
      const y = now.getFullYear() - i;
      out.push({ label: String(y), start: new Date(y, 0, 1).getTime(), end: new Date(y + 1, 0, 1).getTime() });
    }
  }
  return out;
}

// Bucket timestamps into daily/monthly/yearly series. `dedupe` counts distinct uids
// per bucket (for active-users), otherwise counts rows (signups, scores).
function makeSeries(rows: { at: number; uid?: string }[], dedupe = false): TimeSeries {
  const now = new Date();
  const build = (g: Granularity): Point[] => {
    const buckets = buildBuckets(g, now);
    const sets = dedupe ? buckets.map(() => new Set<string>()) : null;
    const counts = buckets.map(() => 0);
    for (const r of rows) {
      const idx = buckets.findIndex((b) => r.at >= b.start && r.at < b.end);
      if (idx < 0) continue;
      if (sets) sets[idx].add(r.uid ?? "");
      else counts[idx] += 1;
    }
    return buckets.map((b, i) => ({ label: b.label, value: sets ? sets[i].size : counts[i] }));
  };
  return { daily: build("daily"), monthly: build("monthly"), yearly: build("yearly") };
}

const TICKET_STATUS_LABEL: Record<RecentTicket["status"], string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

const count = sql<number>`count(*)::int`;
const countDistinctUser = sql<number>`count(distinct ${user.id})::int`;
// User-base metrics count customers only, never admin/operator accounts.
const onlyUsers = eq(user.role, "user");

export async function loadDashboardMetrics(): Promise<DashboardMetrics> {
  const now = Date.now();
  const monthAgo = new Date(now - 30 * DAY);
  const weekAgo = new Date(now - 7 * DAY);
  const fiveYearsAgo = new Date(now - 5 * 366 * DAY);

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
    sessionRows,
    gmailConnectedRows,
    scoredUsersRows,
    recentSignups,
    recentResumes,
    recentScores,
    recentSyncs,
    lastSyncRow,
    ticketStatusRows,
    recentTicketRows,
    ticketRows,
    firstReplyRows,
    ingestErrorRows,
    failingSyncRows,
    resumeStorageRows,
    assetStorageRows,
    planExpiryRows,
  ] = await Promise.all([
    db.select({ n: count }).from(user).where(onlyUsers),
    db.select({ n: count }).from(user).where(and(onlyUsers, sql`${user.createdAt} >= ${monthAgo}`)),
    db.select({ n: count }).from(user).where(and(onlyUsers, eq(user.status, "active"))),
    db.select({ n: count }).from(user).where(and(onlyUsers, sql`${user.lastLoginAt} >= ${weekAgo}`)),
    db.select({ n: count }).from(resumes),
    db.select({ n: sql<number>`count(distinct ${resumes.userId})::int` }).from(resumes),
    db.select({ n: count }).from(fitScores),
    db.select({ n: count }).from(fitScores).where(sql`${fitScores.createdAt} >= ${monthAgo}`),
    db.select({ planId: user.planId, n: count }).from(user).where(onlyUsers).groupBy(user.planId),
    db.select({ status: user.status, n: count }).from(user).where(onlyUsers).groupBy(user.status),
    db.select({ createdAt: user.createdAt }).from(user).where(onlyUsers),
    db.select({ createdAt: fitScores.createdAt }).from(fitScores),
    db
      .select({ createdAt: session.createdAt, uid: session.userId })
      .from(session)
      .innerJoin(user, eq(session.userId, user.id))
      .where(and(onlyUsers, sql`${session.createdAt} >= ${fiveYearsAgo}`)),
    db
      .select({ n: countDistinctUser })
      .from(gmailConfig)
      .innerJoin(user, eq(gmailConfig.userId, user.id))
      .where(and(onlyUsers, eq(gmailConfig.connected, true))),
    db
      .select({ n: countDistinctUser })
      .from(fitScores)
      .innerJoin(user, eq(fitScores.userId, user.id))
      .where(onlyUsers),
    db
      .select({ name: user.name, createdAt: user.createdAt })
      .from(user)
      .where(onlyUsers)
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
    db.select({ status: supportTickets.status, n: count }).from(supportTickets).groupBy(supportTickets.status),
    db
      .select({
        id: supportTickets.id,
        subject: supportTickets.subject,
        name: supportTickets.name,
        status: supportTickets.status,
        createdAt: supportTickets.createdAt,
      })
      .from(supportTickets)
      .orderBy(desc(supportTickets.createdAt))
      .limit(5),
    db
      .select({ id: supportTickets.id, status: supportTickets.status, createdAt: supportTickets.createdAt, updatedAt: supportTickets.updatedAt })
      .from(supportTickets),
    db
      .select({ ticketId: ticketReplies.ticketId, first: sql<string>`min(${ticketReplies.createdAt})` })
      .from(ticketReplies)
      .groupBy(ticketReplies.ticketId),
    db
      .select({ n: count })
      .from(gmailIngestErrors)
      .innerJoin(user, eq(gmailIngestErrors.userId, user.id))
      .where(and(onlyUsers, sql`${gmailIngestErrors.createdAt} >= ${monthAgo}`)),
    db
      .select({ n: countDistinctUser })
      .from(gmailSyncState)
      .innerJoin(user, eq(gmailSyncState.userId, user.id))
      .where(and(onlyUsers, isNotNull(gmailSyncState.lastError))),
    db
      .select({ n: count, bytes: sql<string>`coalesce(sum(octet_length(${resumeFiles.data})), 0)::bigint` })
      .from(resumeFiles),
    db
      .select({ bytes: sql<string>`coalesce(sum(octet_length(${appAssets.data})), 0)::bigint` })
      .from(appAssets),
    db
      .select({ name: user.name, planId: user.planId, expiresAt: user.planExpiresAt })
      .from(user)
      .where(and(onlyUsers, isNotNull(user.planExpiresAt)))
      .orderBy(user.planExpiresAt),
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
      // fit_scores rows — one per (user, lead, resume); rescores overwrite, so this
      // counts leads scored, the only AI signal we persist today.
      key: "ai",
      label: "AI scores (30d)",
      value: String(aiRecent),
      delta: `${aiTotal} all-time`,
    },
  ];

  // --- Time series (daily / monthly / yearly) ---
  const newUsersSeries = makeSeries(userCreatedAt.map((r) => ({ at: new Date(r.createdAt).getTime() })));
  const aiScoresSeries = makeSeries(aiCreatedAt.map((r) => ({ at: new Date(r.createdAt).getTime() })));
  const activeUsersSeries = makeSeries(
    sessionRows.map((r) => ({ at: new Date(r.createdAt).getTime(), uid: r.uid })),
    true,
  );

  // --- Plan distribution (users only) ---
  const planNames = new Map((await db.select({ id: plans.id, name: plans.name }).from(plans)).map((p) => [p.id, p.name]));
  const planMix: Point[] = planMixRows
    .map((r) => ({ label: r.planId ? (planNames.get(r.planId) ?? "Unknown plan") : "No plan", value: r.n }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);

  // --- Status mix (users only) ---
  const statusMix: Point[] = statusMixRows
    .map((r) => ({ label: r.status === "active" ? "Active" : r.status === "inactive" ? "Inactive" : r.status, value: r.n }))
    .filter((p) => p.value > 0);

  // --- Onboarding funnel (users only) ---
  const gmailConnected = gmailConnectedRows[0]?.n ?? 0;
  const scoredUsers = scoredUsersRows[0]?.n ?? 0;
  const pct = (n: number) => (totalUsers > 0 ? Math.round((n / totalUsers) * 100) : 0);
  const funnel: FunnelStage[] = [
    { label: "Signed up", value: totalUsers, pct: 100 },
    { label: "Gmail connected", value: gmailConnected, pct: pct(gmailConnected) },
    { label: "Résumé added", value: resumeUsers, pct: pct(resumeUsers) },
    { label: "Scored a lead", value: scoredUsers, pct: pct(scoredUsers) },
  ];

  // --- Tickets ---
  const ticketTotal = ticketStatusRows.reduce((s, r) => s + r.n, 0);
  const ticketOpen = ticketStatusRows.find((r) => r.status === "open")?.n ?? 0;
  const ticketStatusMix: Point[] = (["open", "in_progress", "resolved"] as const)
    .map((s) => ({ label: TICKET_STATUS_LABEL[s], value: ticketStatusRows.find((r) => r.status === s)?.n ?? 0 }))
    .filter((p) => p.value > 0);
  const ticketStats: TicketStats = { total: ticketTotal, open: ticketOpen, statusMix: ticketStatusMix };
  const recentTickets: RecentTicket[] = recentTicketRows.map((t) => ({
    id: t.id,
    subject: t.subject,
    who: t.name || "Unknown",
    status: t.status as RecentTicket["status"],
    when: relativeTime(new Date(t.createdAt)),
  }));

  // --- Support SLA ---
  const firstReplyAt = new Map(firstReplyRows.map((r) => [r.ticketId, new Date(r.first).getTime()]));
  const firstResponseDurations: number[] = [];
  const resolutionDurations: number[] = [];
  const openAges: number[] = [];
  let resolvedCount = 0;
  for (const t of ticketRows) {
    const created = new Date(t.createdAt).getTime();
    const first = firstReplyAt.get(t.id);
    if (first) firstResponseDurations.push(first - created);
    if (t.status === "resolved") {
      resolvedCount += 1;
      // Approx: updatedAt is last activity; without later replies ≈ resolve time.
      resolutionDurations.push(new Date(t.updatedAt).getTime() - created);
    } else {
      openAges.push(now - created);
    }
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const sla: SlaStats = {
    firstResponse: firstResponseDurations.length ? humanDuration(avg(firstResponseDurations)) : "—",
    resolution: resolutionDurations.length ? humanDuration(avg(resolutionDurations)) : "—",
    openCount: openAges.length,
    oldestOpen: openAges.length ? humanDuration(Math.max(...openAges)) : "—",
    resolutionRate: ticketTotal > 0 ? Math.round((resolvedCount / ticketTotal) * 100) : 0,
  };

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

  // --- Gmail health (users only; read-only Gmail integration) ---
  const gmail: GmailHealth = {
    connected: gmailConnected,
    totalUsers,
    lastSync,
    ingestErrors: ingestErrorRows[0]?.n ?? 0,
    failingSyncs: failingSyncRows[0]?.n ?? 0,
  };

  // --- Storage (bytes stored in Postgres; résumé files + app assets).
  // Résumé bytes are the go-live candidate for moving to S3/R2 (see backlog). ---
  const resumeBytes = Number(resumeStorageRows[0]?.bytes ?? 0);
  const assetBytes = Number(assetStorageRows[0]?.bytes ?? 0);
  const storage: StorageStats = {
    resumeFiles: resumeStorageRows[0]?.n ?? 0,
    resumeSize: humanBytes(resumeBytes),
    assetSize: humanBytes(assetBytes),
    total: humanBytes(resumeBytes + assetBytes),
  };

  // --- Plan expiry (users only; from user.planExpiresAt) ---
  const d7 = now + 7 * DAY;
  const d30 = now + 30 * DAY;
  let expiredCount = 0;
  let soon7 = 0;
  let soon30 = 0;
  const expiryAlerts: PlanExpiryAlert[] = [];
  for (const r of planExpiryRows) {
    const t = new Date(r.expiresAt as Date).getTime();
    const isExpired = t < now;
    if (isExpired) expiredCount += 1;
    else {
      if (t < d30) soon30 += 1;
      if (t < d7) soon7 += 1;
    }
    expiryAlerts.push({
      name: r.name,
      plan: r.planId ? (planNames.get(r.planId) ?? "—") : "—",
      when: isExpired ? `${humanDuration(now - t)} ago` : `in ${humanDuration(t - now)}`,
      expired: isExpired,
      soon: !isExpired && t < d7,
    });
  }
  const planExpiry: PlanExpiry = { expired: expiredCount, soon7, soon30, alerts: expiryAlerts.slice(0, 5) };
  const system: SystemRow[] = [
    { label: "Environment", value: appEnv },
    { label: "App version", value: `v${pkg.version}` },
    { label: "Database", value: "Connected", ok: true },
    { label: "Last Gmail sync", value: lastSync },
  ];

  return {
    stats,
    newUsers: newUsersSeries,
    aiScores: aiScoresSeries,
    activeUsers: activeUsersSeries,
    planMix,
    statusMix,
    funnel,
    gmail,
    storage,
    planExpiry,
    ticketStats,
    recentTickets,
    sla,
    activity,
    system,
  };
}
