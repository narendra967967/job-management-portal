import "server-only";

// In-app nudges when a plan limit stops something from happening on its own
// (e.g. job alerts arriving after the active-lead limit is reached). At most
// one notice per kind per day, so a busy inbox doesn't flood the bell.

import { and, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/db/schema";
import { createNotification } from "@/lib/notifications";

const DAY_MS = 24 * 60 * 60_000;

export async function notifyLeadLimitReached(userId: string, skipped: number): Promise<void> {
  try {
    const [recent] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.type, "plan-limit"),
          gte(notifications.createdAt, new Date(Date.now() - DAY_MS)),
        ),
      )
      .limit(1);
    if (recent) return;
    await createNotification(userId, {
      type: "plan-limit",
      title: "Lead limit reached",
      body: `${skipped} new ${skipped === 1 ? "job" : "jobs"} from your alerts weren't added because you've reached your plan's limit of active leads. Archive leads you're done with, or upgrade for unlimited leads.`,
      href: "/settings?tab=plan",
    });
  } catch (e) {
    // A missed nudge must never break intake.
    console.error("[plan-notices] lead limit notice failed:", e instanceof Error ? e.message : e);
  }
}
