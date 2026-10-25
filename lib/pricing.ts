import "server-only";

// Public read side of the /pricing page. Only active plans the admin has marked
// "Show on pricing page" are listed, and only public fields leave the server
// (no subscriber counts or internal flags).

import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans, user } from "@/db/schema";
import { ACCENT_KEYS, type AccentKey, type Currency } from "@/lib/admin/plans-model";

export interface PublicPlan {
  id: string;
  name: string;
  /** Plain text (the admin description is rich HTML; tags are dropped). */
  summary: string;
  accent: AccentKey;
  isFree: boolean;
  /** Free plan only: days of access (0 = never expires). */
  freeDurationDays: number;
  /** 0 = that interval isn't offered. */
  monthlyPrice: number;
  yearlyPrice: number;
  currency: Currency;
  popular: boolean;
  features: string[];
  /** null = unlimited. */
  limitActiveLeads: number | null;
  limitResumes: number | null;
  limitAiAddMonthly: number | null;
  allowAiDrafts: boolean;
  allowAiEmailReading: boolean;
  allowNotes: boolean;
  allowSalaryInsight: boolean;
  allowAtsCheck: boolean;
  allowCustomPrompts: boolean;
  prioritySupport: boolean;
}

function toText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Plans for the public pricing page: free first, then by monthly price. Build-safe. */
export async function getPricingPlans(): Promise<PublicPlan[]> {
  try {
    const rows = await db
      .select()
      .from(plans)
      .where(and(eq(plans.status, "active"), eq(plans.showOnPricing, true)))
      .orderBy(desc(plans.isFree), asc(plans.monthlyPrice), asc(plans.yearlyPrice));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      summary: toText(r.description),
      accent: ((ACCENT_KEYS as string[]).includes(r.accent) ? r.accent : "indigo") as AccentKey,
      isFree: r.isFree,
      freeDurationDays: r.freeDurationDays,
      monthlyPrice: r.monthlyPrice,
      yearlyPrice: r.yearlyPrice,
      currency: (r.currency === "USD" ? "USD" : "INR") as Currency,
      popular: r.popular,
      features: r.features,
      limitActiveLeads: r.limitActiveLeads,
      limitResumes: r.limitResumes,
      limitAiAddMonthly: r.limitAiAddMonthly,
      allowAiDrafts: r.allowAiDrafts,
      allowAiEmailReading: r.allowAiEmailReading,
      allowNotes: r.allowNotes,
      allowSalaryInsight: r.allowSalaryInsight,
      allowAtsCheck: r.allowAtsCheck,
      allowCustomPrompts: r.allowCustomPrompts,
      prioritySupport: r.prioritySupport,
    }));
  } catch {
    // DB unavailable (e.g. `next build`).
    return [];
  }
}

/** The signed-in user's plan id, to mark "Your plan" on the page. */
export async function getUserPlanId(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const [u] = await db.select({ planId: user.planId }).from(user).where(eq(user.id, userId));
  return u?.planId ?? null;
}
