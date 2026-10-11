"use server";

// User-side plan details for Settings → Plan. Returns the current plan (with its
// colour accent, price, limits, features, and expiry) plus whether an upgrade
// exists. "Higher value" is compared on the monthly price (the default basis;
// a per-user billing interval isn't tracked yet).

import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/current-user";
import { plans, user } from "@/db/schema";

export interface MyPlanDetails {
  name: string;
  accent: string;
  isFree: boolean;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  limitResumes: number | null;
  allowCustomPrompts: boolean;
  features: string[];
  freeDurationDays: number;
  /** ISO string, or null when the plan never expires. */
  expiresAt: string | null;
  /** An active plan with a higher monthly price exists. */
  upgradeAvailable: boolean;
}

export async function getMyPlanAction(): Promise<MyPlanDetails | null> {
  const u = await getSessionUser();
  if (!u) return null;

  const [row] = await db
    .select({ planId: user.planId, planExpiresAt: user.planExpiresAt })
    .from(user)
    .where(eq(user.id, u.id));
  if (!row?.planId) return null;

  const [pl] = await db.select().from(plans).where(eq(plans.id, row.planId));
  if (!pl) return null;

  // Any active plan priced higher (monthly basis) means an upgrade is available.
  const higher = await db
    .select({ id: plans.id })
    .from(plans)
    .where(and(eq(plans.status, "active"), gt(plans.monthlyPrice, pl.monthlyPrice)))
    .limit(1);

  return {
    name: pl.name,
    accent: pl.accent,
    isFree: pl.isFree,
    monthlyPrice: pl.monthlyPrice,
    yearlyPrice: pl.yearlyPrice,
    currency: pl.currency,
    limitResumes: pl.limitResumes,
    allowCustomPrompts: pl.allowCustomPrompts,
    features: pl.features,
    freeDurationDays: pl.freeDurationDays,
    expiresAt: row.planExpiresAt ? row.planExpiresAt.toISOString() : null,
    upgradeAvailable: higher.length > 0,
  };
}
