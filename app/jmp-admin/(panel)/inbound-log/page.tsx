// Inbound email log (Operations, A5): one row per received email — metadata
// only, never content. Admin-gated. PHASE 2: the client shows sample data.

import { requireAdmin } from "@/lib/current-user";
import { InboundLogClient } from "@/components/admin/inbound/inbound-log-client";

export const dynamic = "force-dynamic";

export default async function AdminInboundLogPage() {
  await requireAdmin();
  return <InboundLogClient />;
}
