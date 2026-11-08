// Admin → Engagement → Email templates: the wording of every email the system
// sends on its own.

import { requireAdmin } from "@/lib/current-user";
import { getAppName } from "@/lib/branding";
import { loadTemplateStates } from "@/lib/email-templates";
import { TemplatesList } from "@/components/admin/email-templates/templates-list";

export const dynamic = "force-dynamic";

export default async function EmailTemplatesPage() {
  await requireAdmin();
  const [appName, states] = await Promise.all([getAppName(), loadTemplateStates()]);
  return <TemplatesList appName={appName} states={states} />;
}
