"use server";

// User-side plan details for Settings → Plan. Returns the current plan (with its
// colour accent, price, limits, features, and expiry) plus whether an upgrade
// exists. "Higher value" is compared on the monthly price (the default basis;
// a per-user billing interval isn't tracked yet).

import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/current-user";
import { plans, resumes, user } from "@/db/schema";
import { activeLeadCount, usageThisMonth } from "@/lib/entitlements";
import { toPublicPlan } from "@/lib/pricing";
import type { CurrentPlanInfo, OfferPlan, TaxSettings } from "@/lib/billing-model";
import { getBillingProfile } from "@/lib/billing-data";
import { currentPlanInfo, onlinePaymentAvailable, taxOf } from "@/lib/payments/orders";

export interface MyPlanDetails {
  name: string;
  accent: string;
  isFree: boolean;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  limitResumes: number | null;
  allowCustomPrompts: boolean;
  allowNotes: boolean;
  allowSalaryInsight: boolean;
  allowAtsCheck: boolean;
  limitActiveLeads: number | null;
  limitAiAddMonthly: number | null;
  allowAiDrafts: boolean;
  allowAiEmailReading: boolean;
  prioritySupport: boolean;
  /** What the user has used against the limits right now. */
  usage: { activeLeads: number; resumes: number; aiAddThisMonth: number };
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
    allowNotes: pl.allowNotes,
    allowSalaryInsight: pl.allowSalaryInsight,
    allowAtsCheck: pl.allowAtsCheck,
    limitActiveLeads: pl.limitActiveLeads,
    limitAiAddMonthly: pl.limitAiAddMonthly,
    allowAiDrafts: pl.allowAiDrafts,
    allowAiEmailReading: pl.allowAiEmailReading,
    prioritySupport: pl.prioritySupport,
    usage: {
      activeLeads: await activeLeadCount(u.id),
      resumes: (await db.select({ id: resumes.id }).from(resumes).where(eq(resumes.userId, u.id))).length,
      aiAddThisMonth: await usageThisMonth(u.id, "ai_add"),
    },
    features: pl.features,
    freeDurationDays: pl.freeDurationDays,
    expiresAt: row.planExpiresAt ? row.planExpiresAt.toISOString() : null,
    upgradeAvailable: higher.length > 0,
  };
}

export interface PlanOptions {
  current: CurrentPlanInfo;
  /** The current plan has passed its expiry (limited mode). */
  expired: boolean;
  /** Plans the user can buy: active, paid, listed on the pricing page —
   *  plus their own paid plan for renewal even when it isn't listed. Cheapest first. */
  offers: OfferPlan[];
  tax: TaxSettings;
  /** A gateway is on AND Billing is complete: "Pay" runs checkout. Otherwise
   *  the user requests the plan through support. */
  online: boolean;
}

/** What the plan picker (Settings → Plan, Upgrade Plan) needs. Never offers a
 *  free plan: the free trial is once only and only an admin extends it. */
export async function getPlanOptionsAction(): Promise<PlanOptions | null> {
  const u = await getSessionUser();
  if (!u) return null;

  const [current, billing, online] = await Promise.all([
    currentPlanInfo(u.id),
    getBillingProfile(),
    onlinePaymentAvailable(),
  ]);
  const [cur] = current.planId ? await db.select().from(plans).where(eq(plans.id, current.planId)) : [];

  const listed = await db
    .select()
    .from(plans)
    .where(and(eq(plans.status, "active"), eq(plans.isFree, false), eq(plans.showOnPricing, true)))
    .orderBy(asc(plans.monthlyPrice), asc(plans.yearlyPrice));
  const offers = listed.map(toPublicPlan).filter((p) => p.monthlyPrice > 0 || p.yearlyPrice > 0);
  if (cur && !cur.isFree && cur.status === "active" && !offers.some((o) => o.id === cur.id)) {
    offers.push(toPublicPlan(cur));
    offers.sort((a, b) => a.monthlyPrice - b.monthlyPrice || a.yearlyPrice - b.yearlyPrice);
  }

  return {
    current,
    expired: !!current.expiresAt && new Date(current.expiresAt).getTime() < Date.now(),
    offers,
    tax: taxOf(billing),
    online,
  };
}
