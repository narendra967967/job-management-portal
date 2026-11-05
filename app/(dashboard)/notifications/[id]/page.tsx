// One notification, opened. getNotification scopes to the signed-in user, so a
// user can never open someone else's.

import { notFound } from "next/navigation";
import { z } from "zod";
import { getSessionUser } from "@/lib/current-user";
import { getNotification } from "@/lib/notifications";
import { NotificationView } from "@/components/notifications/notification-view";

export const dynamic = "force-dynamic";

export default async function NotificationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await getSessionUser();
  if (!u || !z.string().uuid().safeParse(id).success) notFound();
  const n = await getNotification(u.id, id);
  if (!n) notFound();
  return <NotificationView n={n} />;
}
