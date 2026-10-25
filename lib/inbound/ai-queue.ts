import "server-only";

// The AI reader's queue (Phase 4i). Emails that need the AI are stored here
// (text + numbered links only) and processed OFF the mail receiver's path:
// right after the inbound request answers (next/server `after`), and by a
// sweep cron (/api/cron/ai-intake) for anything left over — so a slow AI call
// never holds up normal alerts. Each row is deleted once its email is done.

import { and, asc, eq, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  gmailIngestErrors as errorsT,
  inboundAiQueue as queueT,
  inboundEmailLog as logT,
} from "@/db/schema";
import { aiComplete, AI_NOT_CONFIGURED } from "@/lib/ai";
import { AI_READER_SYSTEM, aiReaderPrompt, draftsFromAiReply } from "@/lib/inbound/ai-reader";
import { ingestAlertDrafts } from "@/lib/lead-ingest";
import { getIntakeConfig } from "@/lib/email-intake-data";
import type { InboundStatus } from "@/lib/email-intake-model";

const MAX_ATTEMPTS = 3;
const LOCK_MS = 5 * 60_000; // a claimed row is free again after this (crash-safe)
const GIVE_UP_MS = 24 * 60 * 60_000;
const AI_TIMEOUT_MS = 90_000;
const AI_MAX_TOKENS = 4_000;
const MAX_CONCURRENT = 3; // AI reads in flight per app process; extras wait for the sweep

let running = 0;

type QueueRow = typeof queueT.$inferSelect;

export async function enqueueAiRead(job: {
  userId: string;
  logId: string | null;
  messageId: string;
  site: string;
  subject: string;
  body: string;
  links: string[];
}): Promise<string> {
  const [row] = await db.insert(queueT).values(job).returning({ id: queueT.id });
  return row.id;
}

/** Process one queued email if it's due and nobody else holds it. Safe to
 *  call from several places at once. */
export async function runAiJob(id: string): Promise<void> {
  if (running >= MAX_CONCURRENT) return; // the sweep picks it up
  running++;
  try {
    const now = new Date();
    const [job] = await db
      .update(queueT)
      .set({ lockedAt: now, attempts: sql`${queueT.attempts} + 1` })
      .where(
        and(
          eq(queueT.id, id),
          lte(queueT.nextAt, now),
          or(isNull(queueT.lockedAt), lt(queueT.lockedAt, new Date(now.getTime() - LOCK_MS))),
        ),
      )
      .returning();
    if (job) await processJob(job);
  } finally {
    running--;
  }
}

const short = (msg: string) => msg.replace(/\s+/g, " ").slice(0, 120);

const HAND_LABEL = "Hand-forwarded · ";

async function finish(job: QueueRow, status: InboundStatus, reason: string, leadsCreated = 0) {
  if (job.logId) {
    // Keep the "Hand-forwarded · " label the row was queued with.
    const [row] = await db.select({ reason: logT.reason }).from(logT).where(eq(logT.id, job.logId));
    const label = row?.reason.startsWith(HAND_LABEL) ? HAND_LABEL : "";
    await db
      .update(logT)
      .set({ status, reason: `${label}${reason}`.slice(0, 400), leadsCreated })
      .where(eq(logT.id, job.logId));
  }
  await db.delete(queueT).where(eq(queueT.id, job.id));
}

/** A user-facing ingestion issue (Settings → Ingestion issues). */
async function issue(job: QueueRow, reason: string) {
  await db
    .insert(errorsT)
    .values({ userId: job.userId, messageId: job.messageId, reason, rawExcerpt: job.subject.slice(0, 500) });
}

async function processJob(job: QueueRow) {
  try {
    const { aiMaxJobs } = await getIntakeConfig();
    const reply = await aiComplete(
      job.userId,
      AI_READER_SYSTEM,
      aiReaderPrompt({ site: job.site, subject: job.subject, body: job.body }),
      AI_MAX_TOKENS,
      { temperature: 0, timeoutMs: AI_TIMEOUT_MS },
    );
    const { found, drafts } = draftsFromAiReply(reply, job.links, { site: job.site, maxJobs: aiMaxJobs });
    if (!drafts.length) {
      await issue(job, found ? `AI found ${found} job(s) but none had a link to open` : "AI found no jobs in this email");
      await finish(job, "unsupported", found ? `AI found ${found}, kept 0 (no job links)` : "AI found no jobs");
      return;
    }
    const r = await ingestAlertDrafts(job.userId, drafts, job.messageId);
    const parts = [`${r.inserted} new`];
    if (r.renewed) parts.push(`${r.renewed} renewed`);
    if (r.overLimit) parts.push(`${r.overLimit} not added (plan limit)`);
    await finish(job, "accepted", `AI found ${found}, kept ${drafts.length} · ${parts.join(", ")}`, r.inserted);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === AI_NOT_CONFIGURED) {
      await issue(job, "Unsupported format — add an AI key in Settings → AI provider to read emails from this site");
      await finish(job, "unsupported", "AI key removed before reading");
      return;
    }
    // A rejected key or no credit won't fix itself on retry — stop and say so.
    const status = Number(/ error (\d{3})\b/.exec(msg)?.[1] ?? 0);
    if (status === 401 || status === 403 || status === 402) {
      await issue(
        job,
        status === 402
          ? "Your AI provider has no credit left — top it up, then forward this alert again"
          : "Your AI provider rejected the key — check it in Settings → AI provider, then forward this alert again",
      );
      await finish(job, "unsupported", `AI reader stopped: provider answered ${status} (${short(msg)})`);
      return;
    }
    if (job.attempts >= MAX_ATTEMPTS) {
      await issue(job, "Couldn't read this email with AI — check your AI provider key and credit in Settings");
      await finish(job, "unsupported", `AI reader failed after ${job.attempts} attempts: ${short(msg)}`);
      return;
    }
    // Retry later: 2 min, then 4 min.
    await db
      .update(queueT)
      .set({ lockedAt: null, nextAt: new Date(Date.now() + job.attempts * 2 * 60_000) })
      .where(eq(queueT.id, job.id));
    if (job.logId) {
      const [row] = await db.select({ reason: logT.reason }).from(logT).where(eq(logT.id, job.logId));
      const label = row?.reason.startsWith(HAND_LABEL) ? HAND_LABEL : "";
      await db
        .update(logT)
        .set({ reason: `${label}Reading with AI · attempt ${job.attempts} failed (${short(msg)}), retrying` })
        .where(eq(logT.id, job.logId));
    }
  }
}

/** Cron sweep: give up on day-old rows, then process what's due (oldest first). */
export async function sweepAiQueue(limit = 20): Promise<{ processed: number; expired: number }> {
  const cutoff = new Date(Date.now() - GIVE_UP_MS);
  const stale = await db.select().from(queueT).where(lt(queueT.createdAt, cutoff));
  for (const job of stale) {
    await issue(job, "Couldn't read this email with AI within a day");
    await finish(job, "unsupported", "AI reader gave up after 24 h");
  }

  const now = new Date();
  const due = await db
    .select({ id: queueT.id })
    .from(queueT)
    .where(
      and(
        lte(queueT.nextAt, now),
        or(isNull(queueT.lockedAt), lt(queueT.lockedAt, new Date(now.getTime() - LOCK_MS))),
      ),
    )
    .orderBy(asc(queueT.createdAt))
    .limit(limit);
  for (const { id } of due) await runAiJob(id);
  return { processed: due.length, expired: stale.length };
}
