import { Suspense } from "react";
import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/current-user";
import {
  DEFAULT_TZ,
  PERIOD_COOKIE,
  TZ_COOKIE,
  isTimeZone,
  parsePeriod,
  periodRange,
  todayIn,
} from "@/lib/admin/dashboard-model";
import { loadDashboard } from "@/lib/admin/dashboard-data";
import { getDashboardLayout } from "@/lib/admin/dashboard-layout";
import { DashboardView } from "@/components/admin/dashboard/dashboard-view";

// Admin dashboard (docs/admin-dashboard/spec.md). Figures are counted in the
// database for the selected period, with days in the viewer's time zone
// (sent by the browser in a cookie; Asia/Kolkata until it has).

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const adminId = await requireAdmin();
  const sp = await searchParams;
  const jar = await cookies();
  // No ?period: open on the period this browser used last (parsePeriod validates it).
  const remembered = sp.period ? null : jar.get(PERIOD_COOKIE)?.value;
  const sel = parsePeriod(remembered ? Object.fromEntries(new URLSearchParams(remembered)) : sp);
  const tzCookie = jar.get(TZ_COOKIE)?.value;
  const tz = isTimeZone(tzCookie) ? tzCookie : DEFAULT_TZ;
  const today = todayIn(tz);
  const range = periodRange(sel, today);
  // This admin's own block order and hidden blocks (the default until they edit it).
  const [layout, data] = await Promise.all([getDashboardLayout(adminId), loadDashboard(range, tz, today)]);

  return (
    // Suspense: the period switch reads useSearchParams.
    <Suspense>
      <DashboardView data={data} sel={sel} range={range} timeZone={tz} layout={layout} />
    </Suspense>
  );
}
