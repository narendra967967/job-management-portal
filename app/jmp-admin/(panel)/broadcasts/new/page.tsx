// Admin → Broadcasts → New broadcast.

import { requireAdmin } from "@/lib/current-user";
import { getAppName } from "@/lib/branding";
import { BroadcastEditor } from "@/components/admin/broadcasts/broadcast-editor";

export const dynamic = "force-dynamic";

export default async function NewBroadcastPage() {
  await requireAdmin();
  return <BroadcastEditor existing={undefined} appName={await getAppName()} />;
}
