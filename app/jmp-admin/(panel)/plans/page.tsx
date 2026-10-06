// Plans & Pricing (Sales & Revenue). Server component: admin-gated, loads the real
// plans table, and hands it to the client grid. Mutations go through Server Actions.

import { requireAdmin } from "@/lib/current-user";
import { loadPlans } from "@/lib/admin/plans-data";
import { PlansClient } from "@/components/admin/plans/plans-client";

export default async function AdminPlansPage() {
  await requireAdmin();
  const plans = await loadPlans();
  return <PlansClient initial={plans} />;
}
