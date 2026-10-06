import "server-only";

// Read side of the admin Plans & Pricing page. Loads the plans table and computes
// each plan's current subscriber count from the user table (plan_id is loose text,
// no FK). Mutations live in actions/admin-plans.ts.

import { asc, desc, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans as plansT, user as userT } from "@/db/schema";
import { ACCENT_KEYS, type AccentKey, type Currency, type Plan } from "@/lib/admin/plans-model";

export async function loadPlans(): Promise<Plan[]> {
  const [rows, subCounts] = await Promise.all([
    // Free plans first, then by creation order (seed = free, starter, pro, …).
    db.select().from(plansT).orderBy(desc(plansT.isFree), asc(plansT.createdAt)),
    db
      .select({ planId: userT.planId, count: sql<number>`count(*)::int` })
      .from(userT)
      .where(isNotNull(userT.planId))
      .groupBy(userT.planId),
  ]);

  const subByPlan = new Map(subCounts.map((r) => [r.planId, r.count]));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    description: r.description,
    accent: ((ACCENT_KEYS as string[]).includes(r.accent) ? r.accent : "indigo") as AccentKey,
    isFree: r.isFree,
    freeDurationDays: r.freeDurationDays,
    monthlyPrice: r.monthlyPrice,
    yearlyPrice: r.yearlyPrice,
    currency: (r.currency === "USD" ? "USD" : "INR") as Currency,
    limitResumes: r.limitResumes,
    allowCustomPrompts: r.allowCustomPrompts,
    features: r.features,
    popular: r.popular,
    status: r.status,
    subscribers: subByPlan.get(r.id) ?? 0,
    everSubscribed: r.everSubscribed,
  }));
}
