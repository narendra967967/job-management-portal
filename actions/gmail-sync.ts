"use server";

// Manual "Sync now" for the current user (Settings) — the same per-user sync the
// cron runs, so Gmail ingestion is testable locally without waiting for a
// scheduled run.

import { getCurrentUserId } from "@/lib/current-user";
import { runSyncForUser, type SyncResult } from "@/lib/gmail-sync";

export async function syncMyGmailAction(): Promise<SyncResult> {
  const userId = await getCurrentUserId();
  return runSyncForUser(userId);
}
