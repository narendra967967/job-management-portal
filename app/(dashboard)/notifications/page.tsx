// Notifications: everything saved for the signed-in user. The (dashboard)
// layout enforces the session, and the data is this user's workspace only.

import { NotificationsList } from "@/components/notifications/notifications-list";

export default function NotificationsPage() {
  return <NotificationsList />;
}
