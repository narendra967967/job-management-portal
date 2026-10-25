import "server-only";

// Onboarding tour state. A user sees the tour automatically while their stored
// tour_version is below TOUR_VERSION; finishing or skipping stores the current
// version. Bump TOUR_VERSION to show a new tour once to everyone.

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSettings } from "@/db/schema";

export const TOUR_VERSION = 1;

/** True when the tour should start on its own for this user. Fails closed
 *  (no tour) if the setting can't be read — never blocks the dashboard. */
export async function tourDue(userId: string): Promise<boolean> {
  try {
    const [s] = await db
      .select({ v: userSettings.tourVersion })
      .from(userSettings)
      .where(eq(userSettings.userId, userId));
    return !!s && (s.v ?? 0) < TOUR_VERSION;
  } catch {
    return false;
  }
}
