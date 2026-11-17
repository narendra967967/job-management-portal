import { requireAdmin } from "@/lib/current-user";
import { ModuleSettingsClient } from "@/components/admin/mock-interviews/module-settings";
import { getModuleSettings } from "@/lib/mock-interviews/config";

// Admin → Mock interviews → Module settings (docs/interview-prep/spec.md §4).
export const dynamic = "force-dynamic";

export default async function MockInterviewSettingsPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  await requireAdmin();
  const [settings, sp] = await Promise.all([getModuleSettings(), searchParams]);
  return <ModuleSettingsClient initial={settings} section={sp.section} />;
}
