// New How-to guide (admin).

import { requireAdmin } from "@/lib/current-user";
import { loadAllGuides } from "@/lib/guides-data";
import { groupGuides } from "@/lib/guides-model";
import { GuideEditor } from "@/components/admin/guides/guide-editor";

export const dynamic = "force-dynamic";

export default async function NewGuidePage() {
  await requireAdmin();
  const groups = groupGuides(await loadAllGuides()).map((g) => g.label);
  return <GuideEditor groups={groups} />;
}
