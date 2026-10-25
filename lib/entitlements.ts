import "server-only";

// Plan access, decided on the server from the user's plan. A user gets a
// feature when their plan has the switch on AND the plan hasn't expired; limits
// (leads, résumés, Add with AI per month) come from the plan, null = unlimited.
// Admins always get Notes. Every gated action checks here — the UI only mirrors
// this (locked state + Upgrade), it never decides.

import { and, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { featureUsage, jobLeads, plans, user } from "@/db/schema";
import { OPEN_LEAD_STATUSES } from "@/lib/types";

export interface FeatureAccess {
  notes: boolean;
  salaryInsight: boolean;
  atsCheck: boolean;
  customPrompts: boolean;
  aiDrafts: boolean;
  aiEmailReading: boolean;
  prioritySupport: boolean;
}

export const NO_FEATURES: FeatureAccess = {
  notes: false,
  salaryInsight: false,
  atsCheck: false,
  customPrompts: false,
  aiDrafts: false,
  aiEmailReading: false,
  prioritySupport: false,
};

export interface PlanLimits {
  /** Open (not archived) leads; null = unlimited. */
  activeLeads: number | null;
  resumes: number | null;
  /** "Add with AI" uses per calendar month; null = unlimited. */
  aiAddMonthly: number | null;
}

export const NO_LIMITS: PlanLimits = { activeLeads: null, resumes: null, aiAddMonthly: null };

async function loadPlan(userId: string) {
  const [u] = await db
    .select({ role: user.role, planId: user.planId, planExpiresAt: user.planExpiresAt })
    .from(user)
    .where(eq(user.id, userId));
  if (!u) return null;
  const [pl] = u.planId ? await db.select().from(plans).where(eq(plans.id, u.planId)) : [];
  const expired = !!u.planExpiresAt && u.planExpiresAt.getTime() < Date.now();
  return { isAdmin: u.role === "admin", expired, plan: pl ?? null };
}

export async function getFeatureAccess(userId: string): Promise<FeatureAccess> {
  const p = await loadPlan(userId);
  if (!p) return NO_FEATURES;
  const pl = p.expired ? null : p.plan;
  return {
    notes: p.isAdmin || !!pl?.allowNotes,
    salaryInsight: !!pl?.allowSalaryInsight,
    atsCheck: !!pl?.allowAtsCheck,
    customPrompts: !!pl?.allowCustomPrompts,
    aiDrafts: !!pl?.allowAiDrafts,
    aiEmailReading: !!pl?.allowAiEmailReading,
    prioritySupport: !!pl?.prioritySupport,
  };
}

/** The plan's limits. No plan (admin-provisioned edge case) = unlimited. */
export async function getPlanLimits(userId: string): Promise<PlanLimits> {
  const p = await loadPlan(userId);
  if (!p?.plan) return NO_LIMITS;
  return {
    activeLeads: p.plan.limitActiveLeads,
    resumes: p.plan.limitResumes,
    aiAddMonthly: p.plan.limitAiAddMonthly,
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

/* ---------------- active leads ---------------- */

export async function activeLeadCount(userId: string): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(jobLeads)
    .where(and(eq(jobLeads.userId, userId), inArray(jobLeads.status, OPEN_LEAD_STATUSES)));
  return Number(r?.n ?? 0);
}

/** How many more open leads the user may add (null = no limit). */
export async function leadRoomLeft(userId: string): Promise<number | null> {
  const { activeLeads } = await getPlanLimits(userId);
  if (activeLeads == null) return null;
  return Math.max(0, activeLeads - (await activeLeadCount(userId)));
}

export const leadLimitMessage = (limit: number) =>
  `Your plan allows ${limit} active leads. Archive leads you're done with, or upgrade your plan for unlimited leads.`;

/* ---------------- monthly usage ---------------- */

export type MeteredFeature = "ai_add";

const thisMonth = () => new Date().toISOString().slice(0, 7);

export async function usageThisMonth(userId: string, feature: MeteredFeature): Promise<number> {
  const [r] = await db
    .select({ n: featureUsage.count })
    .from(featureUsage)
    .where(and(eq(featureUsage.userId, userId), eq(featureUsage.feature, feature), eq(featureUsage.month, thisMonth())));
  return r?.n ?? 0;
}

export async function recordUsage(userId: string, feature: MeteredFeature): Promise<void> {
  await db
    .insert(featureUsage)
    .values({ userId, feature, month: thisMonth(), count: 1 })
    .onConflictDoUpdate({
      target: [featureUsage.userId, featureUsage.feature, featureUsage.month],
      set: { count: sql`${featureUsage.count} + 1` },
    });
}

/** Add with AI allowance this month (limit null = unlimited). */
export async function aiAddAllowance(userId: string): Promise<{ limit: number | null; used: number; left: number | null }> {
  const { aiAddMonthly } = await getPlanLimits(userId);
  const used = await usageThisMonth(userId, "ai_add");
  return { limit: aiAddMonthly, used, left: aiAddMonthly == null ? null : Math.max(0, aiAddMonthly - used) };
}
