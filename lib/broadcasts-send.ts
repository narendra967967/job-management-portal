import "server-only";

// The broadcast sender. Runs right after an admin presses Send now, and from
// the server's cron every few minutes for scheduled sends, retries and anything
// a restart interrupted.
//
// Starting a broadcast is one transaction: it's claimed, every user in its
// audience gets the in-app copy at once, and the confirmed addresses go into
// the email queue. Emails then go out one at a time with a gap, because the
// app sends through a mailbox (Hostinger) that blocks bursts and caps the day.
//
// In development only test addresses (.test, .localhost, …) are emailed. The
// local database can hold real people's addresses, and a test send shouldn't
// reach them.

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { broadcastRecipients, broadcasts } from "@/db/schema";
import { getAppBaseUrl, getAppName } from "@/lib/branding";
import { sendAppEmail, SMTP_NOT_CONFIGURED } from "@/lib/email";
import { broadcastExcerpt, sendsEmail, sendsInApp } from "@/lib/broadcasts-model";
import { unsubscribeHeaders, unsubscribePageUrl } from "@/lib/unsubscribe";

const MAX_ATTEMPTS = 3;
/** A claimed email is free again after this; also the wait before a retry. */
const LOCK_MS = 5 * 60_000;
/** Between emails, so the mail server never sees a burst. */
const GAP_MS = 2_000;
/** Per run: about 4 minutes of sending, inside the cron route's 5-minute limit. */
const PER_RUN = 120;
/** Emails a day across all broadcasts; mailbox plans cap sending, so stay under it. */
const DAILY_CAP = Number(process.env.BROADCAST_EMAIL_DAILY_CAP) || 1_000;

const TEST_ADDRESS = /@[^@]+\.(test|localhost|example|invalid)$/i;
const DEV = process.env.NODE_ENV !== "production";

export interface BroadcastRunResult {
  busy?: true;
  started: number;
  sent: number;
  failed: number;
  skipped: number;
  /** Stopped early: the daily cap, or email isn't set up. */
  paused?: "daily-cap" | "no-smtp";
}

/** One run at a time per app process; the next cron run picks up the rest. */
let running = false;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Who a broadcast reaches, as SQL over "user" u left join user_settings s. */
const audience = (promotional: boolean) =>
  sql`u.role = 'user' and u.status <> 'inactive'${promotional ? sql` and not coalesce(s.promo_opt_out, false)` : sql``}`;

const count = (r: unknown) => Number((r as { rows: { n: number }[] }).rows[0]?.n ?? 0);

/** Starts every broadcast that's due. Returns how many started. */
async function startDue(): Promise<number> {
  let started = 0;
  for (;;) {
    const ok = await db.transaction(async (tx) => {
      const claimed = await tx.execute(sql`
        update broadcasts set status = 'sending', started_at = now(), updated_at = now()
        where id = (
          select id from broadcasts
          where status = 'scheduled' and scheduled_for <= now()
          order by scheduled_for
          for update skip locked
          limit 1
        )
        returning id, title, content_html, category, channel
      `);
      const b = (claimed as unknown as { rows: { id: string; title: string; content_html: string; category: string; channel: "in_app" | "email" | "both" }[] }).rows[0];
      if (!b) return false;
      const promo = b.category === "promotional";

      let inApp = 0;
      if (sendsInApp(b.channel)) {
        inApp = count(
          await tx.execute(sql`
            with ins as (
              insert into notifications (user_id, type, title, body, broadcast_id)
              select u.id, 'broadcast', ${b.title}, ${broadcastExcerpt(b.content_html, 200)}, ${b.id}::uuid
              from "user" u left join user_settings s on s.user_id = u.id
              where ${audience(promo)}
              returning 1
            ) select count(*)::int as n from ins
          `),
        );
      }
      let emails = 0;
      if (sendsEmail(b.channel)) {
        emails = count(
          await tx.execute(sql`
            with ins as (
              insert into broadcast_recipients (broadcast_id, user_id, email)
              select ${b.id}::uuid, u.id, u.email
              from "user" u left join user_settings s on s.user_id = u.id
              where ${audience(promo)} and u.email_verified
              on conflict do nothing
              returning 1
            ) select count(*)::int as n from ins
          `),
        );
      }
      await tx
        .update(broadcasts)
        .set({
          inAppCount: inApp,
          emailTotal: emails,
          // Nothing to email: it's done the moment the in-app copies land.
          ...(emails === 0 ? { status: "sent" as const, finishedAt: new Date() } : {}),
        })
        .where(eq(broadcasts.id, b.id));
      return true;
    });
    if (!ok) return started;
    started++;
  }
}

/** Emails a broadcast's message: images and links made absolute, videos as links. */
function emailBody(html: string, unsubscribeUrl: string | null): string {
  const base = getAppBaseUrl();
  let body = html
    .replace(/\s(src|href)="\/(?!\/)/g, ` $1="${base}/`)
    .replace(/<iframe\b[^>]*\bsrc="([^"]+)"[^>]*>\s*(?:<\/iframe>)?/gi, '<p><a href="$1">Watch the video</a></p>')
    .replace(/<video\b[^>]*\bsrc="([^"]+)"[^>]*>[\s\S]*?<\/video>/gi, '<p><a href="$1">Watch the video</a></p>');
  if (unsubscribeUrl) {
    body += `<p style="margin-top:24px;font-size:12px;color:#6b7280">Rather not get emails like this? <a href="${unsubscribeUrl}">Unsubscribe from promotional messages</a>. It takes one click, no sign-in.</p>`;
  }
  return body;
}

type Claimed = { id: string; broadcast_id: string; user_id: string; email: string; attempts: number };

async function claimNext(): Promise<Claimed | null> {
  const r = await db.execute(sql`
    update broadcast_recipients set locked_at = now(), attempts = attempts + 1
    where id = (
      select r.id from broadcast_recipients r
      join broadcasts b on b.id = r.broadcast_id
      where r.status = 'pending' and b.status = 'sending'
        and (r.locked_at is null or r.locked_at < now() - make_interval(secs => ${LOCK_MS / 1000}))
      order by b.started_at, r.created_at
      for update of r skip locked
      limit 1
    )
    returning id, broadcast_id, user_id, email, attempts
  `);
  return (r as unknown as { rows: Claimed[] }).rows[0] ?? null;
}

async function sentInLastDay(): Promise<number> {
  return count(
    await db.execute(sql`select count(*)::int as n from broadcast_recipients where status = 'sent' and sent_at > now() - interval '1 day'`),
  );
}

/** Marks broadcasts whose queue is empty as sent. */
async function finishDone() {
  await db.execute(sql`
    update broadcasts b set status = 'sent', finished_at = now(), updated_at = now()
    where b.status = 'sending'
      and not exists (select 1 from broadcast_recipients r where r.broadcast_id = b.id and r.status = 'pending')
  `);
}

export async function runBroadcasts(): Promise<BroadcastRunResult> {
  if (running) return { busy: true, started: 0, sent: 0, failed: 0, skipped: 0 };
  running = true;
  const result: BroadcastRunResult = { started: 0, sent: 0, failed: 0, skipped: 0 };
  try {
    result.started += await startDue();
    let sentToday = await sentInLastDay();
    const appName = await getAppName();
    const cache = new Map<string, { title: string; html: string; promo: boolean }>();

    for (let i = 0; i < PER_RUN; i++) {
      // A Send now pressed mid-run shouldn't wait for the next cron.
      if (i > 0 && i % 10 === 0) result.started += await startDue();
      if (sentToday >= DAILY_CAP) {
        result.paused = "daily-cap";
        break;
      }
      const job = await claimNext();
      if (!job) break;

      if (DEV && !TEST_ADDRESS.test(job.email)) {
        await db
          .update(broadcastRecipients)
          .set({ status: "skipped", lockedAt: null, lastError: "Development: only test addresses are emailed" })
          .where(eq(broadcastRecipients.id, job.id));
        result.skipped++;
        continue;
      }

      let b = cache.get(job.broadcast_id);
      if (!b) {
        const [row] = await db
          .select({ title: broadcasts.title, html: broadcasts.contentHtml, category: broadcasts.category })
          .from(broadcasts)
          .where(eq(broadcasts.id, job.broadcast_id));
        if (!row) continue;
        b = { title: row.title, html: row.html, promo: row.category === "promotional" };
        cache.set(job.broadcast_id, b);
      }

      try {
        await sendAppEmail({
          to: job.email,
          subject: b.title,
          heading: b.title,
          bodyHtml: emailBody(b.html, b.promo ? unsubscribePageUrl(job.user_id) : null),
          // Promotional only: mail apps show their own one-click Unsubscribe button.
          headers: b.promo ? unsubscribeHeaders(job.user_id) : undefined,
          footerNote: b.promo
            ? `You're getting this because you have a ${appName} account.`
            : `This is a service message about your ${appName} account, so it can't be turned off.`,
        });
        await db
          .update(broadcastRecipients)
          .set({ status: "sent", sentAt: new Date(), lockedAt: null, lastError: null })
          .where(eq(broadcastRecipients.id, job.id));
        await db
          .update(broadcasts)
          .set({ emailSent: sql`${broadcasts.emailSent} + 1` })
          .where(eq(broadcasts.id, job.broadcast_id));
        result.sent++;
        sentToday++;
      } catch (e) {
        const msg = (e instanceof Error ? e.message : String(e)).replace(/\s+/g, " ").slice(0, 300);
        if (msg === SMTP_NOT_CONFIGURED) {
          // Not this email's fault: give the attempt back and stop until it's set up.
          await db
            .update(broadcastRecipients)
            .set({ attempts: sql`${broadcastRecipients.attempts} - 1`, lockedAt: null })
            .where(eq(broadcastRecipients.id, job.id));
          result.paused = "no-smtp";
          break;
        }
        const final = job.attempts >= MAX_ATTEMPTS;
        // Not final: locked_at stays, so the retry waits LOCK_MS.
        await db
          .update(broadcastRecipients)
          .set({ lastError: msg, ...(final ? { status: "failed" as const, lockedAt: null } : {}) })
          .where(eq(broadcastRecipients.id, job.id));
        if (final) {
          await db
            .update(broadcasts)
            .set({ emailFailed: sql`${broadcasts.emailFailed} + 1` })
            .where(eq(broadcasts.id, job.broadcast_id));
          result.failed++;
        }
        console.error(`[broadcasts] email failed (attempt ${job.attempts}):`, msg);
      }
      await sleep(GAP_MS);
    }
    await finishDone();
  } finally {
    running = false;
  }
  if (result.paused === "no-smtp") console.warn("[broadcasts] paused: email isn't set up (Settings → Email delivery)");
  return result;
}

/** Counts of a broadcast's queue by status, for the progress screen. */
export async function queueCounts(broadcastId: string): Promise<{ pending: number; skipped: number }> {
  const rows = await db
    .select({ status: broadcastRecipients.status, n: sql<number>`count(*)::int` })
    .from(broadcastRecipients)
    .where(and(eq(broadcastRecipients.broadcastId, broadcastId), inArray(broadcastRecipients.status, ["pending", "skipped"])))
    .groupBy(broadcastRecipients.status);
  return {
    pending: rows.find((r) => r.status === "pending")?.n ?? 0,
    skipped: rows.find((r) => r.status === "skipped")?.n ?? 0,
  };
}
