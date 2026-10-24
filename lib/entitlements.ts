import "server-only";

// Premium feature access, decided on the server from the user's plan. A user
// gets a feature when their plan has the switch on AND the plan hasn't expired.
// Admins always get Notes. Every premium action calls requireFeature() — the UI
// only mirrors this (locked state + Upgrade), it never decides.

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans, user } from "@/db/schema";

export interface FeatureAccess {
  notes: boolean;
  salaryInsight: boolean;
  atsCheck: boolean;
}

export const NO_FEATURES: FeatureAccess = { notes: false, salaryInsight: false, atsCheck: false };

export async function getFeatureAccess(userId: string): Promise<FeatureAccess> {
  const [u] = await db
    .select({
      role: user.role,
      planId: user.planId,
      planExpiresAt: user.planExpiresAt,
    })
    .from(user)
    .where(eq(user.id, userId));
  if (!u) return NO_FEATURES;

  const isAdmin = u.role === "admin";
  const expired = !!u.planExpiresAt && u.planExpiresAt.getTime() < Date.now();

  let pl: { allowNotes: boolean; allowSalaryInsight: boolean; allowAtsCheck: boolean } | undefined;
  if (u.planId && !expired) {
    [pl] = await db
      .select({
        allowNotes: plans.allowNotes,
        allowSalaryInsight: plans.allowSalaryInsight,
        allowAtsCheck: plans.allowAtsCheck,
      })
      .from(plans)
      .where(eq(plans.id, u.planId));
  }

  return {
    notes: isAdmin || !!pl?.allowNotes,
    salaryInsight: !!pl?.allowSalaryInsight,
    atsCheck: !!pl?.allowAtsCheck,
  };
}

/** Message shown when a premium action is attempted without access. */
export const PREMIUM_REQUIRED =
  "This is a premium feature. Upgrade your plan to use it.";

/** Throw unless the user's plan includes `feature`. */
export async function requireFeature(
  userId: string,
  feature: keyof FeatureAccess,
): Promise<void> {
  const access = await getFeatureAccess(userId);
  if (!access[feature]) throw new Error(PREMIUM_REQUIRED);
}
