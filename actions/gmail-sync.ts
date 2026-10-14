"use server";

// Manual "Sync now" for the current user (Settings) — the same per-user sync the
// cron runs, so Gmail ingestion is testable locally without waiting for a
// scheduled run.

import { z } from "zod";
import { db } from "@/lib/db";
import { gmailConfig as gmailConfigT } from "@/db/schema";
import { getCurrentUserId } from "@/lib/current-user";
import { runSyncForUser, type SyncResult } from "@/lib/gmail-sync";
import { parseInput } from "@/lib/schemas";

export async function syncMyGmailAction(): Promise<SyncResult> {
  const userId = await getCurrentUserId();
  return runSyncForUser(userId);
}

/**
 * Pause or resume job-alert syncing without disconnecting Google. Upserts the
 * user's gmail_config row (it may not exist yet for a brand-new user).
 */
export async function setSyncPausedAction(paused: boolean): Promise<void> {
  const userId = await getCurrentUserId();
  const value = parseInput(z.boolean(), paused);
  const syncPausedAt = value ? new Date() : null;
  await db
    .insert(gmailConfigT)
    .values({ userId, syncPausedAt })
    .onConflictDoUpdate({ target: gmailConfigT.userId, set: { syncPausedAt } });
}
