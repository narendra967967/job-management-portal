// Settings — the single place for the admin's account AND all app-wide
// configuration. Server component: guards the admin session, loads every config
// row, and hands it to the client UI. Mutations live in actions/admin-settings.ts.

import { Suspense } from "react";
import { requireAdmin } from "@/lib/current-user";
import { loadAdminSettings } from "@/lib/admin/settings-data";
import { SettingsClient } from "@/components/admin/settings/settings-client";

export default async function AdminSettingsPage() {
  const adminId = await requireAdmin();
  const initial = await loadAdminSettings(adminId);
  // Suspense boundary: SettingsClient reads useSearchParams (?section=).
  return (
    <Suspense>
      <SettingsClient initial={initial} />
    </Suspense>
  );
}
