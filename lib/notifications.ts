import "server-only";

// Persistent user notifications (the dashboard bell). System events create them;
// they're loaded with the workspace and shown alongside the derived reminder /
// new-lead items. Keep this the single entry point so any feature can notify a
// user the same way.

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { broadcasts, notifications } from "@/db/schema";
import type { BroadcastCategory } from "@/lib/broadcasts-model";

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string; // ISO
  /** Set when it's a broadcast's in-app copy. */
  broadcastCategory: BroadcastCategory | null;
}

/** One opened notification; a broadcast's carries its full message. */
export interface NotificationDetail extends NotificationRow {
  contentHtml: string | null;
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

const withBroadcast = () =>
  db
    .select({ n: notifications, category: broadcasts.category, contentHtml: broadcasts.contentHtml })
    .from(notifications)
    .leftJoin(broadcasts, eq(broadcasts.id, notifications.broadcastId));

type Joined = { n: typeof notifications.$inferSelect; category: BroadcastCategory | null; contentHtml: string | null };

const toRow = ({ n, category }: Joined): NotificationRow => ({
  id: n.id,
  type: n.type,
  title: n.title,
  body: n.body,
  href: n.href,
  read: n.readAt != null,
  createdAt: n.createdAt.toISOString(),
  broadcastCategory: category,
});

/** The newest first; the bell loads 20, the Notifications page more. */
export async function listNotifications(userId: string, limit = 20): Promise<NotificationRow[]> {
  const rows = await withBroadcast()
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows.map(toRow);
}

/** One of this user's notifications, or null (never someone else's). */
export async function getNotification(userId: string, id: string): Promise<NotificationDetail | null> {
  const [r] = await withBroadcast().where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  return r ? { ...toRow(r), contentHtml: r.contentHtml } : null;
}

export async function markNotificationRead(userId: string, id: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId), isNull(notifications.readAt)));
}

/** Mark all of a user's unread notifications read (called when they open the bell). */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
