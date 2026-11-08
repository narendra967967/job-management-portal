// Admin → Email templates → one email's wording.

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/current-user";
import { getAppName } from "@/lib/branding";
import { templateByKey } from "@/lib/email-templates-model";
import { TemplateEditor } from "@/components/admin/email-templates/template-editor";

export const dynamic = "force-dynamic";

export default async function EmailTemplatePage({ params }: { params: Promise<{ key: string }> }) {
  await requireAdmin();
  const { key } = await params;
  if (!templateByKey(key)) notFound();
  return <TemplateEditor templateKey={key} appName={await getAppName()} />;
}
