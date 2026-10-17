// New How-to guide (admin).

import { requireAdmin } from "@/lib/current-user";
import { GuideEditor } from "@/components/admin/guides/guide-editor";

export const dynamic = "force-dynamic";

export default async function NewGuidePage() {
  await requireAdmin();
  return <GuideEditor />;
}
