import "server-only";

// Registration-facing plan reads. The default sign-up plan (plans.is_default,
// active) is what new users land on; registration is only open when it exists
// AND the admin has enabled self sign-up.

import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans } from "@/db/schema";
import { getSignupAllowed } from "@/lib/branding";

export interface DefaultPlan {
  id: string;
  /** Access days before expiry (0 = never expires). */
  freeDurationDays: number;
}

/** The active default sign-up plan, or null when none is configured. Build-safe. */
export const getDefaultPlan = cache(async (): Promise<DefaultPlan | null> => {
  try {
    const [p] = await db
      .select({ id: plans.id, freeDurationDays: plans.freeDurationDays })
      .from(plans)
      .where(and(eq(plans.isDefault, true), eq(plans.status, "active")))
      .limit(1);
    return p ?? null;
  } catch {
    // DB unavailable (e.g. `next build`) — treat as no default.
    return null;
  }
});

/** User-side self-registration is open only when it's enabled AND a default plan exists. */
export async function isRegistrationOpen(): Promise<boolean> {
  const [allowed, def] = await Promise.all([getSignupAllowed(), getDefaultPlan()]);
  return allowed && !!def;
}

/** Expiry for a freshly-assigned plan: now + accessDays, or null when accessDays is 0. */
export function expiryFromAccessDays(accessDays: number): Date | null {
  return accessDays > 0 ? new Date(Date.now() + accessDays * 24 * 60 * 60 * 1000) : null;
}

/** Expiry when an admin assigns a plan today. Free plans use their access days
 *  (0 = never expires); paid plans get one calendar month for now — once payments
 *  exist, the purchased interval (monthly / yearly) decides. */
export async function planExpiryFromNow(planId: string | null): Promise<Date | null> {
  if (!planId) return null;
  const [p] = await db
    .select({ isFree: plans.isFree, freeDurationDays: plans.freeDurationDays })
    .from(plans)
    .where(eq(plans.id, planId));
  if (!p) return null;
  if (p.isFree) return expiryFromAccessDays(p.freeDurationDays);
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d;
}

/** How a new account starts, for public copy: "14-day free trial" when the
 *  default plan expires, else "free plan". Follows admin Plans & Pricing. */
export async function freeStartLabel(): Promise<{ label: string; trialDays: number }> {
  const def = await getDefaultPlan();
  const days = def?.freeDurationDays ?? 0;
  return { label: days > 0 ? `${days}-day free trial` : "free plan", trialDays: days };
}
