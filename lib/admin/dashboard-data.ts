import "server-only";

// Admin dashboard, read side (docs/admin-dashboard/spec.md, phase 3). Every
// figure is counted in the database for the selected period, with days taken
// in the viewer's own time zone. Customer metrics count role = 'user' only:
// admins are operators, not customers.
//
// The deployed commit is baked into the image at build time (APP_COMMIT, see
// the Dockerfile); job runs come from job_runs (lib/job-runs.ts).

import { statfs } from "node:fs/promises";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import type { Point } from "@/components/admin/ui/charts";
import {
  FUNNEL_STEPS,
  addDays,
  links,
  previousRange,
  reachedStep,
  stoppedAt,
  type AttentionItem,
  type BroadcastSummary,
  type DashboardData,
  type DayRange,
  type FunnelFacts,
  type JobRun,
  type TimeSeries,
} from "@/lib/admin/dashboard-model";
import { getEmailDelivery, getEmailProvider, getSesCredentials, providersReady } from "@/lib/email-delivery";
import type { SesAccountInfo } from "@/lib/email-delivery-model";
import { getSesAccount } from "@/lib/ses";
import { JOBS, isLate } from "@/lib/job-runs-model";




type Row = Record<string, unknown>;

async function rows<T extends Row = Row>(q: SQL): Promise<T[]> {
  const r = (await db.execute(q)) as unknown as { rows: T[] };
  return r.rows;
}
async function one<T extends Row = Row>(q: SQL): Promise<T> {
  return ((await rows<T>(q))[0] ?? {}) as T;
}
const num = (v: unknown) => Number(v ?? 0);
const isoOrNull = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

/** Start of a day (inclusive) and of the day after the range (exclusive), as instants in the viewer's zone. */
const startOf = (day: string, tz: string) => sql`((${day}::date)::timestamp at time zone ${tz})`;
const endOf = (day: string, tz: string) => sql`(((${day}::date) + 1)::timestamp at time zone ${tz})`;
const within = (col: SQL, r: DayRange, tz: string) => sql`${col} >= ${startOf(r.from, tz)} and ${col} < ${endOf(r.to, tz)}`;

/* ---------------- time series ---------------- */

const label = (day: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${day}T00:00:00Z`).toLocaleString("en-US", { ...opts, timeZone: "UTC" });

/** Bucket keys and labels: last 30 days, last 12 months, last 5 years (viewer's calendar). */
function buckets(today: string) {
  const daily = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29)).map((k) => ({ k, label: label(k, { month: "short", day: "numeric" }) }));
  const [y, m] = today.split("-").map(Number);
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (11 - i), 1));
    const k = d.toISOString().slice(0, 7);
    return { k, label: label(`${k}-01`, { month: "short" }) };
  });
  const yearly = Array.from({ length: 5 }, (_, i) => ({ k: String(y - 4 + i), label: String(y - 4 + i) }));
  return { daily, monthly, yearly };
}

/**
 * Count rows (or distinct users) of `source` per day, month and year. `source`
 * must select `at` (timestamptz) and `uid`.
 */
async function timeSeries(source: SQL, distinct: boolean, tz: string, today: string): Promise<TimeSeries> {
  const b = buckets(today);
  const counter = distinct ? sql`count(distinct s.uid)` : sql`count(*)`;
  const run = async (unit: "day" | "month" | "year", fmt: string, since: string, keys: { k: string; label: string }[]) => {
    const r = await rows<{ k: string; n: number }>(sql`
      select to_char(date_trunc(${unit}, s.at at time zone ${tz}), ${fmt}) as k, ${counter}::int as n
      from (${source}) s
      where s.at >= ${startOf(since, tz)}
      group by 1`);
    const by = new Map(r.map((x) => [x.k, num(x.n)]));
    return keys.map(({ k, label }) => ({ label, value: by.get(k) ?? 0 }));
  };
  const [daily, monthly, yearly] = await Promise.all([
    run("day", "YYYY-MM-DD", b.daily[0].k, b.daily),
    run("month", "YYYY-MM", `${b.monthly[0].k}-01`, b.monthly),
    run("year", "YYYY", `${b.yearly[0].k}-01-01`, b.yearly),
  ]);
  return { daily, monthly, yearly };
}

/* ---------------- Amazon SES account (live, cached briefly) ---------------- */

let sesCache: { at: number; value: SesAccountInfo | null } | null = null;

/** What SES says about the account right now, cached for 5 minutes; the last Test connection if AWS can't be reached. */
async function sesAccount(stored: SesAccountInfo | null): Promise<SesAccountInfo | null> {
  if (sesCache && Date.now() - sesCache.at < 5 * 60_000) return sesCache.value ?? stored;
  const creds = await getSesCredentials();
  if (!creds) return stored;
  try {
    const value = await Promise.race([
      getSesAccount(creds),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 4_000)),
    ]);
    sesCache = { at: Date.now(), value };
    return value;
  } catch {
    sesCache = { at: Date.now(), value: null };
    return stored;
  }
}

async function diskSize(): Promise<number | null> {
  try {
    const s = await statfs("/");
    return Number(s.blocks) * Number(s.bsize);
  } catch {
    return null;
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/* ---------------- the loader ---------------- */

export async function loadDashboard(range: DayRange, tz: string, today: string): Promise<DashboardData> {
  const prev = previousRange(range);
  const now = Date.now();
  const nowSql = sql`now()`;

  const [
    users,
    signedIn,
    paid,
    revenue,
    revenueByPlan,
    incomplete,
    newUsers,
    newPaidUsers,
    activeUsers,
    planRows,
    cohort,
    support,
    waiting,
    renewals,
    nextRenewals,
    forwarding,
    topRejections,
    broadcastRows,
    gmail,
    storage,
    attention,
    delivery,
    provider,
    ready,
    disk,
    sentLog,
    jobRows,
  ] = await Promise.all([
    one(sql`
      select count(*)::int as total,
        count(*) filter (where ${within(sql`created_at`, range, tz)})::int as joined,
        count(*) filter (where ${within(sql`created_at`, prev, tz)})::int as joined_prev
      from "user" where role = 'user'`),
    one(sql`
      select count(distinct s.user_id) filter (where ${within(sql`s.created_at`, range, tz)})::int as now_n,
        count(distinct s.user_id) filter (where ${within(sql`s.created_at`, prev, tz)})::int as prev_n
      from session s join "user" u on u.id = s.user_id
      where u.role = 'user' and s.created_at >= ${startOf(prev.from, tz)}`),
    one(sql`
      with cohort as (
        select u.id, u.created_at,
          exists (select 1 from payment_orders o where o.user_id = u.id and o.status = 'paid' and o.mode = 'live') as paid
        from "user" u where u.role = 'user'
      )
      select
        (select count(*)::int from "user" u left join plans p on p.id::text = u.plan_id
          where u.role = 'user' and not coalesce(p.is_free, true)
            and (u.plan_expires_at is null or u.plan_expires_at > now())) as paid_now,
        count(*) filter (where ${within(sql`created_at`, range, tz)})::int as joined,
        count(*) filter (where ${within(sql`created_at`, range, tz)} and paid)::int as joined_paid,
        count(*) filter (where ${within(sql`created_at`, prev, tz)})::int as joined_prev,
        count(*) filter (where ${within(sql`created_at`, prev, tz)} and paid)::int as joined_paid_prev
      from cohort`),
    one(sql`
      select
        coalesce(sum(base_amount) filter (where ${within(sql`paid_at`, range, tz)}), 0)::bigint as total,
        count(*) filter (where ${within(sql`paid_at`, range, tz)})::int as orders,
        coalesce(sum(base_amount) filter (where ${within(sql`paid_at`, prev, tz)}), 0)::bigint as prev,
        count(*) filter (where ${within(sql`paid_at`, prev, tz)})::int as prev_orders,
        max(currency) as currency
      from payment_orders where status = 'paid' and mode = 'live' and paid_at >= ${startOf(prev.from, tz)}`),
    rows<{ plan: string; amount: number }>(sql`
      select plan_name as plan, sum(base_amount)::bigint as amount
      from payment_orders
      where status = 'paid' and mode = 'live' and ${within(sql`paid_at`, range, tz)}
      group by 1 order by 2 desc`),
    one(sql`
      select
        count(*) filter (where status = 'created')::int as unpaid,
        count(*) filter (where status = 'failed')::int as failed,
        (select max(failed_at) from payment_orders where status = 'failed' and mode = 'live') as last_failed
      from payment_orders where mode = 'live' and ${within(sql`created_at`, range, tz)}`),
    timeSeries(sql`select created_at as at, id as uid from "user" where role = 'user'`, false, tz, today),
    timeSeries(
      sql`select min(o.paid_at) as at, o.user_id as uid from payment_orders o join "user" u on u.id = o.user_id
          where o.status = 'paid' and o.mode = 'live' and u.role = 'user' group by o.user_id`,
      false,
      tz,
      today,
    ),
    timeSeries(sql`select s.created_at as at, s.user_id as uid from session s join "user" u on u.id = s.user_id where u.role = 'user'`, true, tz, today),
    rows<{ pid: string | null; name: string | null; free: boolean; expired: boolean; n: number }>(sql`
      select p.id::text as pid, p.name, coalesce(p.is_free, true) as free,
        (u.plan_expires_at is not null and u.plan_expires_at < now() and not coalesce(p.is_free, true)) as expired,
        count(*)::int as n
      from "user" u left join plans p on p.id::text = u.plan_id
      where u.role = 'user'
      group by 1, 2, 3, 4`),
    rows<{ verified: boolean; fwd: boolean; ai: boolean; resume: boolean; leads: number; free: boolean }>(sql`
      select u.email_verified as verified,
        (ia.first_received_at is not null) as fwd,
        (us.ai_key_ciphertext is not null) as ai,
        exists (select 1 from resumes r where r.user_id = u.id) as resume,
        (select count(*)::int from job_leads l where l.user_id = u.id) as leads,
        coalesce(p.is_free, true) as free
      from "user" u
      left join inbound_addresses ia on ia.user_id = u.id
      left join user_settings us on us.user_id = u.id
      left join plans p on p.id::text = u.plan_id
      where u.role = 'user' and ${within(sql`u.created_at`, range, tz)}`),
    one(sql`
      select
        (select count(*)::int from support_tickets where status = 'open') as open,
        (select count(*)::int from support_tickets where status = 'in_progress') as in_progress,
        (select min(created_at) from support_tickets where status <> 'resolved') as oldest,
        (select avg(extract(epoch from (r.first_at - t.created_at)))
           from support_tickets t
           join (select ticket_id, min(created_at) as first_at from ticket_replies where author = 'admin' group by ticket_id) r
             on r.ticket_id = t.id
           where ${within(sql`t.created_at`, range, tz)}) as first_reply_s,
        (select avg(extract(epoch from (t.updated_at - t.created_at)))
           from support_tickets t
           where t.status = 'resolved' and ${within(sql`t.created_at`, range, tz)}) as resolve_s`),
    rows<{ id: string; number: number; subject: string; name: string; status: "open" | "in_progress"; created_at: string }>(sql`
      select id, number, subject, name, status, created_at
      from support_tickets where status <> 'resolved'
      order by created_at asc limit 5`),
    one(sql`
      select
        count(*) filter (where plan_expires_at > ${nowSql} and plan_expires_at <= ${nowSql} + interval '7 days')::int as due7,
        count(*) filter (where plan_expires_at > ${nowSql} and plan_expires_at <= ${nowSql} + interval '30 days')::int as due30,
        count(*) filter (where plan_expires_at <= ${nowSql} and plan_expires_at > ${nowSql} - interval '30 days')::int as ended30
      from "user" where role = 'user' and plan_expires_at is not null`),
    rows<{ id: string; name: string; plan: string | null; ends: string }>(sql`
      select u.id, u.name, p.name as plan, u.plan_expires_at as ends
      from "user" u left join plans p on p.id::text = u.plan_id
      where u.role = 'user' and u.plan_expires_at > now()
      order by u.plan_expires_at asc limit 5`),
    one(sql`
      select
        (select forwarding_enabled from email_intake_config where id = 'app') as enabled,
        (select count(*)::int from inbound_addresses ia join "user" u on u.id = ia.user_id
          where u.role = 'user' and ia.first_received_at is not null) as set_up,
        (select count(*)::int from "user" where role = 'user') as total,
        count(*)::int as received,
        count(*) filter (where status = 'accepted')::int as accepted,
        count(*) filter (where status = 'rejected')::int as rejected,
        (select max(received_at) from inbound_email_log) as last_at
      from inbound_email_log where ${within(sql`received_at`, range, tz)}`),
    rows<{ reason: string; n: number }>(sql`
      select coalesce(reason, 'No reason given') as reason, count(*)::int as n
      from inbound_email_log
      where status = 'rejected' and ${within(sql`received_at`, range, tz)}
      group by 1 order by 2 desc limit 3`),
    rows<{
      kind: "next" | "sending" | "last";
      id: string;
      title: string;
      at: string;
      email_total: number;
      email_sent: number;
      email_failed: number;
      in_app: number;
    }>(sql`
      (select 'next' as kind, id, title, scheduled_for as at, email_total, email_sent, email_failed, in_app_count as in_app
         from broadcasts where status = 'scheduled' order by scheduled_for asc limit 1)
      union all
      (select 'sending', id, title, started_at, email_total, email_sent, email_failed, in_app_count
         from broadcasts where status = 'sending' order by started_at desc limit 1)
      union all
      (select 'last', id, title, finished_at, email_total, email_sent, email_failed, in_app_count
         from broadcasts where status = 'sent' order by finished_at desc nulls last limit 1)`),
    one(sql`
      select
        (select gmail_oauth_enabled from email_intake_config where id = 'app') as enabled,
        (select count(distinct g.user_id)::int from gmail_config g join "user" u on u.id = g.user_id
          where u.role = 'user' and g.connected) as connected,
        (select count(*)::int from "user" where role = 'user') as total,
        (select max(last_synced_at) from gmail_sync_state) as last_sync,
        (select count(*)::int from gmail_ingest_errors e join "user" u on u.id = e.user_id
          where u.role = 'user' and ${within(sql`e.created_at`, range, tz)}) as ingest_errors,
        (select count(distinct s.user_id)::int from gmail_sync_state s join "user" u on u.id = s.user_id
          where u.role = 'user' and s.last_error is not null) as failing`),
    one(sql`
      select
        pg_database_size(current_database())::bigint as db_bytes,
        (select count(*)::int from resume_files) as resume_files,
        (select coalesce(sum(octet_length(data)), 0)::bigint from resume_files) as resume_bytes,
        (select coalesce(sum(octet_length(data)), 0)::bigint from app_assets) as asset_bytes`),
    one(sql`
      select
        (select count(*)::int from support_tickets where status <> 'resolved' and created_at < now() - interval '24 hours') as tickets_waiting,
        (select count(*)::int from payment_orders where status = 'failed' and mode = 'live' and failed_at > now() - interval '7 days') as failed_payments,
        (select count(*)::int from "user" u left join plans p on p.id::text = u.plan_id
          where u.role = 'user' and not coalesce(p.is_free, true)
            and u.plan_expires_at <= now() and u.plan_expires_at > now() - interval '7 days') as expired_plans,
        (select count(*)::int from support_tickets
          where category = 'deletion' and status <> 'resolved' and cancelled_at is null) as deletion_requests,
        (select count(*)::int from inbound_ai_queue where created_at < now() - interval '1 hour') as ai_stuck,
        (select count(*)::int from kb_questions where status = 'open') as kb_open,
        (select count(*)::int from "user"
          where role = 'user' and status = 'inactive' and updated_at > now() - interval '7 days') as deactivated`),
    getEmailDelivery(),
    getEmailProvider(),
    providersReady(),
    diskSize(),
    // Every email the app handed to a channel, admins and tests included: this is delivery health.
    rows<{ channel: string; sent: number; failed: number }>(sql`
      select channel,
        count(*) filter (where status = 'sent')::int as sent,
        count(*) filter (where status = 'failed')::int as failed
      from sent_email_log where ${within(sql`sent_at`, range, tz)}
      group by channel order by count(*) desc`),
    rows(sql`select job, last_finished_at, last_ok, last_error, failures_in_a_row from job_runs`),
  ]);

  /* ---- revenue by month (amounts, last 12 months) ---- */
  const b = buckets(today);
  const monthRows = await rows<{ k: string; amount: number }>(sql`
    select to_char(date_trunc('month', paid_at at time zone ${tz}), 'YYYY-MM') as k, sum(base_amount)::bigint as amount
    from payment_orders
    where status = 'paid' and mode = 'live' and paid_at >= ${startOf(`${b.monthly[0].k}-01`, tz)}
    group by 1`);
  const monthBy = new Map(monthRows.map((r) => [r.k, num(r.amount)]));

  /* ---- plan mix ---- */
  const mix = new Map<string, { label: string; value: number; plan: string }>();
  for (const r of planRows) {
    const key = r.expired ? "expired" : r.free ? `free:${r.pid ?? "none"}` : (r.pid as string);
    const entry = r.expired
      ? { label: "Expired", plan: "expired" }
      : r.free
        ? { label: r.name ?? "No plan", plan: "free" }
        : { label: r.name ?? "Unknown plan", plan: r.pid as string };
    mix.set(key, { ...entry, value: (mix.get(key)?.value ?? 0) + num(r.n) });
  }
  const planMix = [...mix.values()].filter((p) => p.value > 0).sort((a, z) => z.value - a.value);

  /* ---- funnel (people who joined in the period) ---- */
  const facts: FunnelFacts[] = cohort.map((c) => ({
    emailVerified: !!c.verified,
    forwardingReceived: !!c.fwd,
    hasAiKey: !!c.ai,
    hasResume: !!c.resume,
    leads: num(c.leads),
    paid: !c.free,
  }));
  const funnel = FUNNEL_STEPS.map((s) => ({
    ...s,
    value: facts.filter((f) => reachedStep(s.key, f)).length,
    stopped: facts.filter((f) => stoppedAt(s.key, f)).length,
  }));

  /* ---- broadcasts ---- */
  const summary = (kind: "next" | "sending" | "last"): BroadcastSummary | null => {
    const r = broadcastRows.find((x) => x.kind === kind);
    if (!r || !r.at) return null;
    // In-app only broadcasts have no emails; show who got it in the app instead.
    const emails = num(r.email_total) > 0;
    return {
      id: r.id,
      title: r.title,
      at: new Date(r.at).toISOString(),
      total: emails ? num(r.email_total) : num(r.in_app),
      delivered: emails ? num(r.email_sent) : num(r.in_app),
      failed: emails ? num(r.email_failed) : 0,
    };
  };
  const broadcasts = { next: summary("next"), sending: summary("sending"), last: summary("last") };

  /* ---- email delivery ---- */
  const sesConfigured = !!(delivery.ses.region && delivery.ses.accessKeyId && delivery.ses.hasSecret);
  const account = provider === "ses" && sesConfigured ? await sesAccount(delivery.ses.account) : null;

  /* ---- scheduled jobs (System block and Needs attention) ---- */
  const jobs: JobRun[] = JOBS.map((j) => {
    const r = jobRows.find((x) => x.job === j.key);
    const lastRunAt = r ? isoOrNull(r.last_finished_at) : null;
    return {
      key: j.key,
      label: j.label,
      every: j.every,
      lastRunAt,
      ok: r ? r.last_ok === true : null,
      error: r?.last_error ? String(r.last_error) : undefined,
      failuresInARow: num(r?.failures_in_a_row),
      late: isLate(lastRunAt, j.lateAfterMin, now),
    };
  });
  // A failed job is reported as failed, not also as late. Jobs that have never
  // run (a fresh environment) aren't flagged.
  const failedJobs = jobs.filter((j) => j.ok === false);
  const lateJobs = jobs.filter((j) => j.ok === true && j.late);
  const names = (list: JobRun[]) => list.map((j) => j.label).join(", ");

  /* ---- needs attention ---- */
  const a = attention;
  const last7 = { from: addDays(today, -6), to: today };
  const items: AttentionItem[] = [];
  const add = (cond: boolean, item: AttentionItem) => cond && items.push(item);
  add(provider ? !ready[provider] : false, {
    key: "email-not-ready",
    severity: "critical",
    count: 1,
    text: "Email isn't set up, so the app can't send any",
    href: links.settings("email"),
  });
  add(failedJobs.length > 0, {
    key: "jobs-failed",
    severity: "critical",
    count: failedJobs.length,
    text:
      failedJobs.length === 1
        ? `${failedJobs[0].label} failed on its last run`
        : `${failedJobs.length} scheduled jobs failed on their last run: ${names(failedJobs)}`,
    href: links.systemBlock(),
  });
  add(num(a.tickets_waiting) > 0, {
    key: "tickets-waiting",
    severity: "critical",
    count: num(a.tickets_waiting),
    text: `${plural(num(a.tickets_waiting), "ticket", "tickets")} waiting more than 24 hours`,
    href: links.tickets({ status: "unresolved", waitingHours: 24 }),
  });
  add(num(a.failed_payments) > 0, {
    key: "failed-payments",
    severity: "critical",
    count: num(a.failed_payments),
    text: `${plural(num(a.failed_payments), "payment", "payments")} failed in the last 7 days`,
    href: links.orders({ status: "failed", mode: "live", ...last7 }),
  });
  add(!forwarding.enabled, {
    key: "forwarding-off",
    severity: "critical",
    count: 1,
    text: "Forwarding is turned off, so no job alerts come in",
    href: links.settings("intake"),
  });
  add(lateJobs.length > 0, {
    key: "jobs-late",
    severity: "warning",
    count: lateJobs.length,
    text:
      lateJobs.length === 1
        ? `${lateJobs[0].label} hasn't run on schedule`
        : `${lateJobs.length} scheduled jobs haven't run on schedule: ${names(lateJobs)}`,
    href: links.systemBlock(),
  });
  add(num(a.expired_plans) > 0, {
    key: "expired-plans",
    severity: "warning",
    count: num(a.expired_plans),
    text: `${plural(num(a.expired_plans), "paid plan", "paid plans")} ended in the last 7 days without renewal`,
    href: links.renewals({ due: "ended30" }),
  });
  add(num(a.deletion_requests) > 0, {
    key: "deletion-requests",
    severity: "warning",
    count: num(a.deletion_requests),
    text: plural(num(a.deletion_requests), "account deletion request", "account deletion requests"),
    href: `/jmp-admin/tickets?status=unresolved&category=deletion`,
  });
  add(num(a.ai_stuck) > 0, {
    key: "ai-queue",
    severity: "warning",
    count: num(a.ai_stuck),
    text: `${plural(num(a.ai_stuck), "job alert", "job alerts")} waiting in the AI reading queue for over an hour`,
    href: links.inbound({ status: "queued" }),
  });
  add(gmail.enabled === true && num(gmail.failing) > 0, {
    key: "gmail-failing",
    severity: "warning",
    count: num(gmail.failing),
    text: `${plural(num(gmail.failing), "Gmail sync is", "Gmail syncs are")} failing`,
    href: links.users(),
  });
  add(provider === "ses" && account !== null && !account.productionAccess, {
    key: "ses-sandbox",
    severity: "warning",
    count: 1,
    text: "Amazon SES is still in the sandbox, so most users won't get email",
    href: links.settings("email"),
  });
  add((broadcasts.last?.failed ?? 0) > 0, {
    key: "broadcast-failed",
    severity: "info",
    count: broadcasts.last?.failed ?? 0,
    text: `${plural(broadcasts.last?.failed ?? 0, "email", "emails")} failed in the last broadcast`,
    href: links.broadcasts({ id: broadcasts.last?.id }),
  });
  add(num(a.kb_open) > 0, {
    key: "kb-unanswered",
    severity: "info",
    count: num(a.kb_open),
    text: `${plural(num(a.kb_open), "unanswered knowledge base question", "unanswered knowledge base questions")}`,
    href: links.kbUnanswered(),
  });
  add(num(a.deactivated) > 0, {
    key: "deactivated",
    severity: "info",
    count: num(a.deactivated),
    text: `${plural(num(a.deactivated), "account", "accounts")} deactivated in the last 7 days`,
    href: links.users({ status: "inactive" }),
  });

  const conv = (paidN: unknown, joinedN: unknown) => (num(joinedN) > 0 ? Math.round((num(paidN) / num(joinedN)) * 100) : 0);
  const oldest = support.oldest ? new Date(support.oldest as string).getTime() : null;

  return {
    generatedAt: new Date(now).toISOString(),
    attention: items,
    users: { total: num(users.total), joined: num(users.joined), joinedPrev: num(users.joined_prev) },
    signedIn: { count: num(signedIn.now_n), prev: num(signedIn.prev_n) },
    paid: {
      count: num(paid.paid_now),
      conversionPct: conv(paid.joined_paid, paid.joined),
      prevConversionPct: num(paid.joined_prev) > 0 ? conv(paid.joined_paid_prev, paid.joined_prev) : null,
    },
    revenue: {
      total: num(revenue.total),
      prev: num(revenue.prev),
      orders: num(revenue.orders),
      byMonth: b.monthly.map(({ k, label }): Point => ({ label, value: monthBy.get(k) ?? 0 })),
      byPlan: revenueByPlan.map((r) => ({ label: r.plan, value: num(r.amount) })),
      currency: (revenue.currency as string) || "INR",
    },
    incompleteOrders: { unpaid: num(incomplete.unpaid), failed: num(incomplete.failed), lastFailedAt: isoOrNull(incomplete.last_failed) },
    newUsers,
    newPaidUsers,
    activeUsers,
    planMix,
    funnel,
    support: {
      open: num(support.open),
      inProgress: num(support.in_progress),
      oldestOpenMs: oldest === null ? null : now - oldest,
      avgFirstResponseMs: support.first_reply_s == null ? null : num(support.first_reply_s) * 1000,
      avgResolutionMs: support.resolve_s == null ? null : num(support.resolve_s) * 1000,
      waiting: waiting.map((t) => ({
        id: t.id,
        number: num(t.number),
        subject: t.subject,
        who: t.name || "Unknown",
        status: t.status,
        waitingMs: now - new Date(t.created_at).getTime(),
      })),
    },
    renewals: {
      due7: num(renewals.due7),
      due30: num(renewals.due30),
      expired30: num(renewals.ended30),
      next: nextRenewals.map((r) => ({ userId: r.id, name: r.name, plan: r.plan ?? "No plan", endsAt: new Date(r.ends).toISOString() })),
    },
    forwarding: {
      enabled: forwarding.enabled !== false,
      usersSetUp: num(forwarding.set_up),
      usersTotal: num(forwarding.total),
      received: num(forwarding.received),
      rejected: num(forwarding.rejected),
      acceptedPct:
        num(forwarding.accepted) + num(forwarding.rejected) > 0
          ? Math.round((num(forwarding.accepted) / (num(forwarding.accepted) + num(forwarding.rejected))) * 100)
          : 100,
      lastReceivedAt: isoOrNull(forwarding.last_at),
      topRejections: topRejections.map((r) => ({ reason: r.reason, count: num(r.n) })),
    },
    emailDelivery: {
      provider,
      ready: ready[provider],
      sesSandbox: account ? !account.productionAccess : null,
      sesQuota: account ? { used: account.sentLast24Hours, max: account.max24HourSend } : null,
      log: {
        sent: sentLog.reduce((a, c) => a + num(c.sent), 0),
        failed: sentLog.reduce((a, c) => a + num(c.failed), 0),
        byChannel: sentLog.map((c) => ({ channel: c.channel, sent: num(c.sent), failed: num(c.failed) })),
      },
    },
    broadcasts,
    gmail: {
      enabled: gmail.enabled === true,
      connected: num(gmail.connected),
      totalUsers: num(gmail.total),
      lastSyncAt: isoOrNull(gmail.last_sync),
      ingestErrors: num(gmail.ingest_errors),
      failingSyncs: num(gmail.failing),
    },
    system: {
      environment: process.env.APP_ENV ?? (process.env.NODE_ENV === "production" ? "Production" : "Development"),
      commit: process.env.APP_COMMIT ? process.env.APP_COMMIT.slice(0, 7) : null,
      dbSizeBytes: num(storage.db_bytes),
      diskBytes: disk,
      resumeBytes: num(storage.resume_bytes),
      resumeFiles: num(storage.resume_files),
      assetBytes: num(storage.asset_bytes),
      jobs,
    },
  };
}
