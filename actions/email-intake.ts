"use server";

// Email forwarding — user actions (Settings → Email forwarding). Always scoped
// to the signed-in user; the address is created on first use.

import { getCurrentUserId } from "@/lib/current-user";
import {
  getIntakeConfig,
  getOrCreateForwarding,
  markForwardingConfirmed,
  resetForwarding,
} from "@/lib/email-intake-data";
import type { MyForwarding } from "@/lib/email-intake-model";

export interface MyForwardingState {
  forwardingEnabled: boolean;
  forwarding: MyForwarding;
}

/** Current address + progress (polled while waiting for Gmail's code). */
export async function getMyForwardingAction(): Promise<MyForwardingState> {
  const userId = await getCurrentUserId();
  const [config, forwarding] = await Promise.all([getIntakeConfig(), getOrCreateForwarding(userId)]);
  return { forwardingEnabled: config.forwardingEnabled, forwarding };
}

/** Replace the address; the old one stops working immediately. */
export async function resetMyForwardingAction(): Promise<MyForwardingState> {
  const userId = await getCurrentUserId();
  const [config, forwarding] = await Promise.all([getIntakeConfig(), resetForwarding(userId)]);
  return { forwardingEnabled: config.forwardingEnabled, forwarding };
}

/** "I've verified it in Gmail" — Gmail never tells us, so the user does. */
export async function confirmMyForwardingAction(): Promise<MyForwardingState> {
  const userId = await getCurrentUserId();
  await markForwardingConfirmed(userId);
  return getMyForwardingAction();
}
