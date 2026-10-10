import "server-only";

// Maintenance mode: when the admin turns it on (Settings → General), the whole
// user side is taken offline and redirected to the public /maintenance page. The
// admin panel (/jmp-admin) and /api are never gated, so the admin can turn it
// back off. Source of truth is app_settings.maintenance.

import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { appSettings } from "@/db/schema";

export const isMaintenanceOn = cache(async (): Promise<boolean> => {
  try {
    const [s] = await db.select({ maintenance: appSettings.maintenance }).from(appSettings).limit(1);
    return !!s?.maintenance;
  } catch {
    // DB unavailable (e.g. `next build` runs with no DATABASE_URL, or a runtime
    // outage) — don't force the maintenance redirect; degrade open. This also lets
    // `next build` reach the dynamic `headers()` call so these routes resolve as
    // dynamic instead of failing to prerender.
    return false;
  }
});

/** Call at the top of every user-facing page/layout: bounces to /maintenance
 *  while maintenance mode is on. */
export async function guardMaintenance(): Promise<void> {
  if (await isMaintenanceOn()) redirect("/maintenance");
}
