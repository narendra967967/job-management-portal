import "server-only";

// A user's billing details (billing_profiles), read and written for the
// signed-in user only by actions/billing-details.ts, and read by checkout to
// copy onto each order. The same checks as the form (billingErrors) run here,
// so the server refuses exactly what the screen refuses.

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { billingProfiles } from "@/db/schema";
import { billingErrors, type BillingDetails } from "@/lib/invoices/billing-details";

export async function getUserBilling(userId: string): Promise<BillingDetails | null> {
  const [r] = await db.select().from(billingProfiles).where(eq(billingProfiles.userId, userId)).limit(1);
  if (!r) return null;
  return {
    fullName: r.fullName,
    mobile: r.mobile,
    addressLine: r.addressLine,
    city: r.city,
    stateCode: r.stateCode,
    pin: r.pin,
    country: "IN",
    gstin: r.gstin ?? "",
    businessName: r.businessName ?? "",
    pan: r.pan ?? "",
  };
}

/** Tidies, checks and saves. Returns the first problem, or null when saved. */
export async function saveUserBilling(userId: string, input: BillingDetails): Promise<string | null> {
  const d: BillingDetails = {
    fullName: input.fullName.trim(),
    mobile: input.mobile.replace(/\D/g, ""),
    addressLine: input.addressLine.trim(),
    city: input.city.trim(),
    stateCode: input.stateCode.trim(),
    pin: input.pin.trim(),
    country: "IN",
    gstin: input.gstin.trim().toUpperCase(),
    businessName: input.gstin.trim() ? input.businessName.trim() : "",
    pan: input.pan.trim().toUpperCase(),
  };
  const errors = Object.values(billingErrors(d));
  if (errors.length) return errors[0]!;
  const values = {
    fullName: d.fullName,
    mobile: d.mobile,
    addressLine: d.addressLine,
    city: d.city,
    stateCode: d.stateCode,
    pin: d.pin,
    country: d.country,
    gstin: d.gstin || null,
    businessName: d.businessName || null,
    pan: d.pan || null,
  };
  await db
    .insert(billingProfiles)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: billingProfiles.userId, set: values });
  return null;
}
