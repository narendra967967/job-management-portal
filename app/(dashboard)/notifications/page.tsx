// Notifications: everything saved for the signed-in user. The (dashboard)
// layout enforces the session, and the query is scoped to this user.

import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/current-user";
import { listNotifications } from "@/lib/notifications";
import { NotificationsList } from "@/components/notifications/notifications-list";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const u = await getSessionUser();
  if (!u) notFound();
  return <NotificationsList rows={await listNotifications(u.id, 100)} />;
}
