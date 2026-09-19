import "server-only";

// Gmail sync orchestration. For a user: build their Gmail query from saved
// ingestion rules, list matching messages (incrementally after the first
// backfill), parse each LinkedIn alert into leads, and insert them deduped by
// (user_id, linkedin_job_id). Parse failures go to gmail_ingest_errors; a
// per-message dedupe table avoids re-parsing. Everything is scoped per user
// (multi-user), so runAll iterates every connected account.

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  account as accountT,
  gmailConfig as gmailConfigT,
  gmailIngestErrors as errorsT,
  gmailProcessedMessages as processedT,
  gmailSyncState as syncStateT,
  jobLeads as leadsT,
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
  errors: number;
  message?: string;
}

export async function runSyncForUser(userId: string): Promise<SyncResult> {
  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken(userId);
  } catch (err) {
    if (err instanceof Error && err.message === GOOGLE_NOT_CONNECTED) {
      return { connected: false, fetched: 0, inserted: 0, errors: 0, message: "Google not connected." };
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
          const res = await db
            .insert(leadsT)
            .values({
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
            })
            .onConflictDoNothing({
              target: [leadsT.userId, leadsT.linkedinJobId],
            })
            .returning({ id: leadsT.id });
          if (res.length > 0) inserted++;
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

    return { connected: true, fetched, inserted, errors: errorCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .insert(syncStateT)
      .values({ userId, lastRunAt: new Date(), lastError: message.slice(0, 500) })
      .onConflictDoUpdate({
        target: syncStateT.userId,
        set: { lastRunAt: new Date(), lastError: message.slice(0, 500) },
      });
    return { connected: true, fetched, inserted, errors: errorCount + 1, message };
  }
}

/** Run the sync for every user with a linked Google account (cron entry point). */
export async function runSyncForAllUsers(): Promise<
  { userId: string; result: SyncResult }[]
> {
  const users = await db
    .selectDistinct({ userId: accountT.userId })
    .from(accountT)
    .where(eq(accountT.providerId, "google"));

  const out: { userId: string; result: SyncResult }[] = [];
  for (const { userId } of users) {
    out.push({ userId, result: await runSyncForUser(userId) });
  }
  return out;
}
