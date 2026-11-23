// Other answers (Customers): what users typed after picking "Other" in a
// dropdown, grouped, with a status per value. Admin-gated; the client loads the data.

import { requireAdmin } from "@/lib/current-user";
import { OtherAnswersClient } from "@/components/admin/other-answers/other-answers-client";

export const dynamic = "force-dynamic";

export default async function AdminOtherAnswersPage() {
  await requireAdmin();
  return <OtherAnswersClient />;
}
