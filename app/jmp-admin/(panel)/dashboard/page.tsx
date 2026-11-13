import { Suspense } from "react";
import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/current-user";
import { LAYOUT_COOKIE, PERIOD_COOKIE, parseLayout, parsePeriod } from "@/lib/admin/dashboard-model";
import { sampleDashboard } from "@/lib/admin/dashboard-sample";
import { DashboardView } from "@/components/admin/dashboard/dashboard-view";

// Admin dashboard (docs/admin-dashboard/spec.md). PHASE 1: every figure comes
// from lib/admin/dashboard-sample.ts so the screens can be reviewed first;
// phase 3 swaps in real data from the database.

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; sample?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const jar = await cookies();
  // No ?period: open on the period this browser used last (parsePeriod validates it).
  const remembered = sp.period ? null : jar.get(PERIOD_COOKIE)?.value;
  const sel = parsePeriod(remembered ? Object.fromEntries(new URLSearchParams(remembered)) : sp);
  // The admin's block order and hidden blocks. PHASE 6 UI: a cookie for now;
  // the database step moves it to a per-admin row.
  const layout = parseLayout(jar.get(LAYOUT_COOKIE)?.value);
  const quiet = sp.sample === "quiet";
  const data = sampleDashboard(sel, quiet);

  return (
    // Suspense: the period switch reads useSearchParams.
    <Suspense>
      <DashboardView data={data} sel={sel} layout={layout} sample={{ quiet }} />
    </Suspense>
  );
}
