// Renewals (Sales): plans ending soon, users in limited mode, and the
// plan-ending reminder emails. Admin-gated; the client loads the data.

import { requireAdmin } from "@/lib/current-user";
import { RenewalsClient } from "@/components/admin/renewals/renewals-client";

export const dynamic = "force-dynamic";

export default async function AdminRenewalsPage() {
  await requireAdmin();
  return <RenewalsClient />;
}
