// Admin → Engagement → Email templates: the wording of every email the system
// sends on its own.

import { requireAdmin } from "@/lib/current-user";
import { getAppName } from "@/lib/branding";
import { TemplatesList } from "@/components/admin/email-templates/templates-list";

export const dynamic = "force-dynamic";

export default async function EmailTemplatesPage() {
  await requireAdmin();
  return <TemplatesList appName={await getAppName()} />;
}
