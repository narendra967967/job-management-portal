import "server-only";

// Creates the default per-user settings rows for a newly created user, so every
// user starts with sensible defaults from the moment they exist (multi-user
// readiness). Idempotent — safe to call more than once.
//
// Wired into Better Auth's user.create.after hook, so any user created through
// auth (the future admin flow) is provisioned automatically. The seed provisions
// its dev user directly.

import { db } from "@/lib/db";
import { gmailConfig, userSettings } from "@/db/schema";
import { DEFAULT_GMAIL_SETTINGS } from "@/lib/use-gmail-settings";

export async function provisionUserDefaults(userId: string): Promise<void> {
  // user_settings column defaults supply reminder/stale/sync intervals, AI
  // provider, etc.; inserting just the id is enough.
  await db.insert(userSettings).values({ userId }).onConflictDoNothing();
  // Seed the common LinkedIn alert senders so the sync works out of the box.
  await db
    .insert(gmailConfig)
    .values({ userId, senders: DEFAULT_GMAIL_SETTINGS.senders })
    .onConflictDoNothing();
}
