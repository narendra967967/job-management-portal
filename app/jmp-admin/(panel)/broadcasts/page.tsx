// Admin → Broadcasts: messages sent to every user, in the app and by email.

import { requireAdmin } from "@/lib/current-user";
import { BroadcastsList } from "@/components/admin/broadcasts/broadcasts-list";

export const dynamic = "force-dynamic";

export default async function BroadcastsPage() {
  await requireAdmin();
  return <BroadcastsList />;
}
