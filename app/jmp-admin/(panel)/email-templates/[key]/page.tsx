// Admin → Email templates → one email's wording.

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/current-user";
import { getAppName } from "@/lib/branding";
import { loadTemplate } from "@/lib/email-templates";
import { TemplateEditor } from "@/components/admin/email-templates/template-editor";

export const dynamic = "force-dynamic";

export default async function EmailTemplatePage({ params }: { params: Promise<{ key: string }> }) {
  await requireAdmin();
  const { key } = await params;
  const [data, appName] = await Promise.all([loadTemplate(key), getAppName()]);
  if (!data) notFound();
  return <TemplateEditor state={data.state} versions={data.versions} appName={appName} />;
}
