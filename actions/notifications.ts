"use server";

import { getCurrentUserId } from "@/lib/current-user";
import { markAllNotificationsRead } from "@/lib/notifications";

/** Mark the current user's notifications read (called when the bell opens). */
export async function markNotificationsReadAction(): Promise<void> {
  const userId = await getCurrentUserId();
  await markAllNotificationsRead(userId);
}
