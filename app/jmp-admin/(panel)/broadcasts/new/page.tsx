// Admin → Broadcasts → New broadcast.

import { requireAdmin } from "@/lib/current-user";
import { getAppName } from "@/lib/branding";
import { loadAudiences } from "@/lib/broadcasts-data";
import { BroadcastEditor } from "@/components/admin/broadcasts/broadcast-editor";

export const dynamic = "force-dynamic";

export default async function NewBroadcastPage() {
  await requireAdmin();
  const [audiences, appName] = await Promise.all([loadAudiences(), getAppName()]);
  return <BroadcastEditor existing={undefined} audiences={audiences} appName={appName} />;
}
