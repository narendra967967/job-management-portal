// Admin → Broadcasts → one broadcast: the editor until it starts, then its progress.

import { requireAdmin } from "@/lib/current-user";
import { getAppName } from "@/lib/branding";
import { BroadcastScreen } from "@/components/admin/broadcasts/broadcast-screen";

export const dynamic = "force-dynamic";

export default async function BroadcastPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  return <BroadcastScreen id={id} appName={await getAppName()} />;
}
