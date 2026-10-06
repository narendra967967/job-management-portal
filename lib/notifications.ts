import "server-only";

// Persistent user notifications (the dashboard bell). System events create them;
// they're loaded with the workspace and shown alongside the derived reminder /
// new-lead items. Keep this the single entry point so any feature can notify a
// user the same way.

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/db/schema";

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string; // ISO
}

export async function createNotification(
  userId: string,
  input: { type: string; title: string; body: string; href?: string },
): Promise<void> {
  await db.insert(notifications).values({
    userId,
    type: input.type,
    title: input.title,
    body: input.body,
    href: input.href ?? null,
  });
}

export async function listNotifications(userId: string, limit = 20): Promise<NotificationRow[]> {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    href: r.href,
    read: r.readAt != null,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Mark all of a user's unread notifications read (called when they open the bell). */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
