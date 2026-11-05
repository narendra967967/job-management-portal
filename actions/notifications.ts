"use server";

import { z } from "zod";
import { getCurrentUserId } from "@/lib/current-user";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications";

/** Mark the current user's notifications read (called when the bell opens). */
export async function markNotificationsReadAction(): Promise<void> {
  const userId = await getCurrentUserId();
  await markAllNotificationsRead(userId);
}

/** Mark one of the current user's notifications read (opening it from a link). */
export async function markNotificationReadAction(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!z.string().uuid().safeParse(id).success) return;
  await markNotificationRead(userId, id);
}
