"use server";

// The signed-in user's billing details (Settings → Profile, and the form
// checkout opens when they're missing). Allowed in limited mode: someone whose
// plan has ended needs them to renew. Zod first, then the shared checks.

import { z } from "zod";
import { getCurrentUserId } from "@/lib/current-user";
import { getUserBilling, saveUserBilling } from "@/lib/invoices/billing-profile";
import type { BillingDetails } from "@/lib/invoices/billing-details";

const detailsSchema = z.object({
  fullName: z.string().max(100),
  mobile: z.string().max(20),
  addressLine: z.string().max(200),
  city: z.string().max(80),
  stateCode: z.string().max(2),
  pin: z.string().max(6),
  country: z.literal("IN"),
  gstin: z.string().max(15),
  businessName: z.string().max(150),
  pan: z.string().max(10),
});

export async function getMyBillingAction(): Promise<BillingDetails | null> {
  return getUserBilling(await getCurrentUserId());
}

export async function saveMyBillingAction(raw: unknown): Promise<{ ok: true; details: BillingDetails } | { ok: false; error: string }> {
  const userId = await getCurrentUserId();
  const p = detailsSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "Some details aren't in the right format. Check the form and try again." };
  const error = await saveUserBilling(userId, p.data);
  if (error) return { ok: false, error };
  return { ok: true, details: (await getUserBilling(userId))! };
}
