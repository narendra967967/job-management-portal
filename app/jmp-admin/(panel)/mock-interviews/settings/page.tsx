import { Suspense } from "react";
import { requireAdmin } from "@/lib/current-user";
import { ModuleSettings } from "@/components/admin/mock-interviews/module-settings";
import { SHOW_SAMPLE_SCREENS } from "@/lib/mock-interviews/preview";
import { AdminComingSoon } from "@/components/admin/mock-interviews/admin-coming-soon";

// Admin → Mock interviews → Module settings (docs/interview-prep/spec.md §4).
// PHASE R1.3: sample settings, outside production only.
export const dynamic = "force-dynamic";

export default async function MockInterviewSettingsPage() {
  await requireAdmin();
  if (!SHOW_SAMPLE_SCREENS) return <AdminComingSoon title="Mock interviews settings" />;
  return (
    <Suspense>
      <ModuleSettings />
    </Suspense>
  );
}
