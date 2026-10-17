// How-to guides (Operations). Server component: admin-gated, loads every topic
// (active and inactive) and hands them to the client list. Mutations go through
// Server Actions in actions/admin-guides.ts.

import { requireAdmin } from "@/lib/current-user";
import { loadAllGuides } from "@/lib/guides-data";
import { GuidesAdminClient } from "@/components/admin/guides/guides-admin-client";

export const dynamic = "force-dynamic";

export default async function AdminGuidesPage() {
  await requireAdmin();
  const topics = await loadAllGuides();
  return <GuidesAdminClient topics={topics} />;
}
