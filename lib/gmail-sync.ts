import "server-only";

// Gmail sync orchestration. For a user: build their Gmail query from saved
// ingestion rules, list matching messages (incrementally after the first
// backfill), parse each LinkedIn alert into leads, and insert them deduped by
// (user_id, linkedin_job_id). Parse failures go to gmail_ingest_errors; a
// per-message dedupe table avoids re-parsing. Everything is scoped per user
// (multi-user), so runAll iterates every connected account.

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { isJobOpen } from "@/lib/types";
import {
  account as accountT,
  gmailConfig as gmailConfigT,
  gmailIngestErrors as errorsT,
  gmailProcessedMessages as processedT,
  gmailSyncState as syncStateT,
  jobLeads as leadsT,
  userSettings as settingsT,
} from "@/db/schema";
import {
  buildGmailQuery,
  DEFAULT_GMAIL_SETTINGS,
  type GmailSettings,
} from "@/lib/use-gmail-settings";
import {
  getGoogleAccessToken,
  getMessage,
  listMessageIds,
  GOOGLE_NOT_CONNECTED,
} from "@/lib/gmail";
import { parseLinkedInAlert } from "@/lib/linkedin-parser";

export interface SyncResult {
  connected: boolean;
  fetched: number;
  inserted: number;
  renewed: number;
  errors: number;
  message?: string;
}

export async function runSyncForUser(userId: string): Promise<SyncResult> {
  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken(userId);
  } catch (err) {
    if (err instanceof Error && err.message === GOOGLE_NOT_CONNECTED) {
      return { connected: false, fetched: 0, inserted: 0, renewed: 0, errors: 0, message: "Google not connected." };
    }
    throw err;
  }

  const [cfgRow] = await db
    .select()
    .from(gmailConfigT)
    .where(eq(gmailConfigT.userId, userId));
  const cfg: GmailSettings = cfgRow
    ? {
        senders: cfgRow.senders,
        label: cfgRow.label ?? "",
        subjectKeywords: cfgRow.subjectKeywords ?? "",
        lookbackDays: cfgRow.lookbackDays,
      }
    : DEFAULT_GMAIL_SETTINGS;

  const [state] = await db
    .select()
    .from(syncStateT)
    .where(eq(syncStateT.userId, userId));

  // First run backfills the lookback window; later runs fetch only what's new.
  let query = buildGmailQuery(cfg);
  if (state?.lastSyncedAt) {
    const epoch = Math.floor(state.lastSyncedAt.getTime() / 1000) - 3600; // 1h overlap
    query = `${buildGmailQuery({ ...cfg, lookbackDays: 0 })} after:${epoch}`;
  }

  let fetched = 0;
  let inserted = 0;
  let renewed = 0;
  let errorCount = 0;

  try {
    const ids = await listMessageIds(accessToken, query, 100);

    // Skip messages already processed.
    const processed =
      ids.length > 0
        ? new Set(
            (
              await db
                .select({ messageId: processedT.messageId })
                .from(processedT)
                .where(
                  and(
                    eq(processedT.userId, userId),
                    inArray(processedT.messageId, ids),
                  ),
                )
            ).map((r) => r.messageId),
          )
        : new Set<string>();

    for (const id of ids) {
      if (processed.has(id)) continue;
      fetched++;
      const msg = await getMessage(accessToken, id);
      const drafts = parseLinkedInAlert(msg.html);

      if (drafts.length === 0) {
        await db.insert(errorsT).values({
          userId,
          messageId: id,
          reason: "No job cards parsed from alert",
          rawExcerpt: msg.subject.slice(0, 500),
        });
        errorCount++;
      } else {
        for (const d of drafts) {
          const [existing] = await db
            .select({
              id: leadsT.id,
              status: leadsT.status,
              tags: leadsT.tags,
            })
            .from(leadsT)
            .where(
              and(
                eq(leadsT.userId, userId),
                eq(leadsT.linkedinJobId, d.linkedinJobId),
              ),
            );

          if (!existing) {
            await db.insert(leadsT).values({
              userId,
              linkedinJobId: d.linkedinJobId,
              title: d.title,
              company: d.company,
              location: d.location,
              remote: d.remote,
              tags: d.tags,
              postedRelative: d.postedRelative,
              canonicalJobUrl: d.canonicalJobUrl,
              sourceMessageId: id,
            });
            inserted++;
          } else if (isJobOpen(existing.status)) {
            // Re-seen active lead: resurface it (bump capture date) + tag
            // "Re-newed", keeping its contacts/reminders. Discarded/closed
            // leads are left untouched.
            const mergedTags = [
              ...new Set([...existing.tags, ...d.tags, "Re-newed"]),
            ];
            await db
              .update(leadsT)
              .set({
                capturedAt: new Date(),
                tags: mergedTags,
                updatedAt: new Date(),
              })
              .where(eq(leadsT.id, existing.id));
            renewed++;
          }
        }
      }

      await db
        .insert(processedT)
        .values({ userId, messageId: id })
        .onConflictDoNothing();
    }

    // Advance the cursor only on a fully successful run.
    await db
      .insert(syncStateT)
      .values({ userId, lastSyncedAt: new Date(), lastRunAt: new Date(), lastError: null })
      .onConflictDoUpdate({
        target: syncStateT.userId,
        set: { lastSyncedAt: new Date(), lastRunAt: new Date(), lastError: null },
      });

    return { connected: true, fetched, inserted, renewed, errors: errorCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .insert(syncStateT)
      .values({ userId, lastRunAt: new Date(), lastError: message.slice(0, 500) })
      .onConflictDoUpdate({
        target: syncStateT.userId,
        set: { lastRunAt: new Date(), lastError: message.slice(0, 500) },
      });
    return { connected: true, fetched, inserted, renewed, errors: errorCount + 1, message };
  }
}

/** Run the sync for every connected user whose interval has elapsed (cron entry
 *  point). Each user's sync_interval_hours gates whether they're due, so the
 *  cron can fire frequently while each user syncs at their chosen cadence. */
export async function runSyncForAllUsers(): Promise<
  { userId: string; result: SyncResult; skipped?: boolean }[]
> {
  const users = await db
    .selectDistinct({ userId: accountT.userId })
    .from(accountT)
    .where(eq(accountT.providerId, "google"));

  const out: { userId: string; result: SyncResult; skipped?: boolean }[] = [];
  for (const { userId } of users) {
    if (!(await isDue(userId))) {
      out.push({
        userId,
        skipped: true,
        result: { connected: true, fetched: 0, inserted: 0, renewed: 0, errors: 0, message: "Not due yet." },
      });
      continue;
    }
    out.push({ userId, result: await runSyncForUser(userId) });
  }
  return out;
}

/** Whether enough time has passed since the user's last run for their interval. */
async function isDue(userId: string): Promise<boolean> {
  const [settings] = await db
    .select({ hours: settingsT.syncIntervalHours })
    .from(settingsT)
    .where(eq(settingsT.userId, userId));
  const [state] = await db
    .select({ lastRunAt: syncStateT.lastRunAt })
    .from(syncStateT)
    .where(eq(syncStateT.userId, userId));

  if (!state?.lastRunAt) return true; // never run
  const hours = settings?.hours ?? 24;
  const elapsedMs = Date.now() - state.lastRunAt.getTime();
  return elapsedMs >= hours * 3600_000;
}
