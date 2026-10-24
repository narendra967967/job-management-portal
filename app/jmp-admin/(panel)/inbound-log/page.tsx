// Inbound email log (Operations, A5): one row per received email — metadata
// only, never content. Admin-gated. Filters live in the URL
// (?from=&to=&tzo=&user=&status=&q=&page=&size=) and run in the database; with
// no dates the client fills in today (in the viewer's timezone) and fetches.

import { requireAdmin } from "@/lib/current-user";
import { InboundLogClient, type InboundLogFilters } from "@/components/admin/inbound/inbound-log-client";
import { listInboundLog } from "@/lib/email-intake-data";
import { getRetentionConfig } from "@/lib/retention";
import { INBOUND_LOG_PAGE_SIZES, INBOUND_STATUS_LABELS, type InboundStatus } from "@/lib/email-intake-model";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60_000;
const MAX_RANGE_DAYS = 366;

/** "YYYY-MM-DD" → that date's midnight in the viewer's timezone, as an instant.
 *  tzo is the browser's getTimezoneOffset() (minutes, UTC − local). */
function localMidnight(date: string, tzo: number): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(t) ? null : t + tzo * 60_000;
}

export default async function AdminInboundLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const retention = await getRetentionConfig();

  const tzo = Math.max(-840, Math.min(840, Math.trunc(Number(sp.tzo ?? 0)) || 0));
  const filters: InboundLogFilters = {
    from: sp.from ?? "",
    to: sp.to ?? "",
    tzo,
    user: (sp.user ?? "").slice(0, 254),
    status: sp.status && sp.status in INBOUND_STATUS_LABELS ? (sp.status as InboundStatus) : "all",
    q: (sp.q ?? "").slice(0, 100),
    page: Math.max(1, Math.trunc(Number(sp.page ?? 1)) || 1),
    size: (INBOUND_LOG_PAGE_SIZES as readonly number[]).includes(Number(sp.size)) ? Number(sp.size) : 50,
  };

  let since = localMidnight(filters.from, tzo);
  let until = localMidnight(filters.to, tzo);
  if (since === null || until === null) {
    // No (valid) dates yet: the client sets today's and fetches.
    return <InboundLogClient filters={filters} rows={[]} total={0} retentionDays={retention.inboundLogDays} needsDates />;
  }
  if (since > until) [since, until] = [until, since];
  until += DAY_MS; // "to" is inclusive: up to the end of that day
  since = Math.max(since, until - MAX_RANGE_DAYS * DAY_MS);

  const { rows, total } = await listInboundLog({
    since: new Date(since),
    until: new Date(until),
    status: filters.status === "all" ? undefined : filters.status,
    userEmail: filters.user,
    q: filters.q,
    page: filters.page,
    size: filters.size,
  });
  return <InboundLogClient filters={filters} rows={rows} total={total} retentionDays={retention.inboundLogDays} />;
}
