import "server-only";

// Lead intake (forwarded alerts, the AI reader, Gmail sync) pauses while a
// user's plan has ended or their account is deactivated, and picks up again
// as soon as the plan is active. Forwarded mail is still accepted (so Gmail
// never sees a bounce and turns forwarding off), logged as "paused", and not
// read; nothing is kept to replay later. Gmail resumes from its saved cursor,
// because those emails are still in the user's own mailbox.

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/db/schema";

/** Why intake is paused for this user right now, or null when it runs. */
export async function intakePausedReason(userId: string): Promise<string | null> {
  const [u] = await db
    .select({ status: user.status, planExpiresAt: user.planExpiresAt })
    .from(user)
    .where(eq(user.id, userId));
  if (!u) return null;
  if (u.status === "inactive") return "Paused: account deactivated";
  if (u.planExpiresAt && u.planExpiresAt.getTime() < Date.now()) return "Paused: plan ended";
  return null;
}
