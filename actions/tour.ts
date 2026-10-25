"use server";

// Onboarding tour: remember that the signed-in user finished or skipped it.

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/current-user";
import { userSettings } from "@/db/schema";
import { TOUR_VERSION } from "@/lib/tour";

export async function markTourSeenAction(): Promise<void> {
  const userId = await getCurrentUserId();
  await db.update(userSettings).set({ tourVersion: TOUR_VERSION }).where(eq(userSettings.userId, userId));
}
