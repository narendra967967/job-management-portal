// Inbound email log (Operations, A5): one row per received email — metadata
// only, never content. Admin-gated. Filters live in the URL (?status=&q=) and
// run in the database.

import { requireAdmin } from "@/lib/current-user";
import { InboundLogClient } from "@/components/admin/inbound/inbound-log-client";
import { INBOUND_LOG_PAGE, listInboundLog } from "@/lib/email-intake-data";
import { INBOUND_STATUS_LABELS, type InboundStatus } from "@/lib/email-intake-model";

export const dynamic = "force-dynamic";

export default async function AdminInboundLogPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const status = sp.status && sp.status in INBOUND_STATUS_LABELS ? (sp.status as InboundStatus) : undefined;
  const q = (sp.q ?? "").slice(0, 100);
  const rows = await listInboundLog({ status, q });
  return <InboundLogClient rows={rows} status={status ?? "all"} q={q} pageSize={INBOUND_LOG_PAGE} />;
}
