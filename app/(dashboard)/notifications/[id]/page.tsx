// One notification, opened. Looked up in the signed-in user's own workspace.

import { NotificationView } from "@/components/notifications/notification-view";

export default async function NotificationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NotificationView id={id} />;
}
