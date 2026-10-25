import "server-only";

// Applies admin Settings → Data retention: deletes log-like rows older than
// each type's window. Called by the daily purge cron (/api/cron/purge-leads).

import { lt } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  actionCodes,
  gmailIngestErrors,
  gmailProcessedMessages,
  inboundEmailLog,
  leadPurgeLog,
  notifications,
  retentionConfig,
} from "@/db/schema";
import { RETENTION_DEFAULTS, RETENTION_TYPES, type RetentionConfig, type RetentionKey } from "@/lib/retention-model";

export async function getRetentionConfig(): Promise<RetentionConfig> {
  const [row] = await db.select().from(retentionConfig).limit(1);
  const out = { ...RETENTION_DEFAULTS };
  for (const t of RETENTION_TYPES) {
    const v = row?.[t.key];
    // Clamp to the allowed range even if the row was edited by hand.
    if (typeof v === "number") out[t.key] = Math.min(t.max, Math.max(t.min, v));
  }
  return out;
}

const cutoff = (days: number) => new Date(Date.now() - days * 24 * 60 * 60_000);

/** Delete everything past its window. Returns rows removed per type. */
export async function runRetention(): Promise<Record<RetentionKey, number>> {
  const c = await getRetentionConfig();
  // Expired one-time confirmation codes (lib/action-codes.ts) — no setting needed.
  await db.delete(actionCodes).where(lt(actionCodes.expiresAt, new Date()));
  const removed = async (q: Promise<{ id?: unknown }[]>) => (await q).length;
  return {
    inboundLogDays: await removed(
      db.delete(inboundEmailLog).where(lt(inboundEmailLog.receivedAt, cutoff(c.inboundLogDays))).returning({ id: inboundEmailLog.id }),
    ),
    ingestIssueDays: await removed(
      db.delete(gmailIngestErrors).where(lt(gmailIngestErrors.createdAt, cutoff(c.ingestIssueDays))).returning({ id: gmailIngestErrors.id }),
    ),
    processedLedgerDays: await removed(
      db
        .delete(gmailProcessedMessages)
        .where(lt(gmailProcessedMessages.processedAt, cutoff(c.processedLedgerDays)))
        .returning({ id: gmailProcessedMessages.messageId }),
    ),
    leadPurgeLogDays: await removed(
      db.delete(leadPurgeLog).where(lt(leadPurgeLog.runAt, cutoff(c.leadPurgeLogDays))).returning({ id: leadPurgeLog.id }),
    ),
    notificationDays: await removed(
      db.delete(notifications).where(lt(notifications.createdAt, cutoff(c.notificationDays))).returning({ id: notifications.id }),
    ),
  };
}
