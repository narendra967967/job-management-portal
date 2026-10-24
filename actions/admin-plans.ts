"use server";

// Admin Plans & Pricing Server Actions. Admin-guarded, Zod-validated. Enforces the
// plan rules server-side: a paid plan needs at least one price; exactly one free
// plan is active at a time; "recommended" is single-winner; the active free plan
// and any ever-used plan can't be deleted.

import { eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/current-user";
import { plans, user } from "@/db/schema";
import { ACCENT_KEYS } from "@/lib/admin/plans-model";

type Result = { ok: true } | { ok: false; error: string };

function fail(e: z.ZodError): Result {
  return { ok: false, error: e.issues[0]?.message ?? "Invalid input." };
}
function revalidate() {
  revalidatePath("/jmp-admin/plans");
}

const planSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(60),
  code: z
    .string()
    .trim()
    .min(1, "Code is required.")
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Code must be lowercase letters, numbers, and hyphens."),
  description: z.string().max(5000).optional().default(""),
  accent: z.string().refine((v) => (ACCENT_KEYS as string[]).includes(v), "Invalid accent."),
  isFree: z.boolean(),
  isDefault: z.boolean().optional().default(false),
  freeDurationDays: z.coerce.number().int().min(0).max(3650),
  monthlyPrice: z.coerce.number().int().min(0).max(10_000_000),
  yearlyPrice: z.coerce.number().int().min(0).max(100_000_000),
  currency: z.enum(["INR", "USD"]),
  limitResumes: z.coerce.number().int().min(0).max(100_000).nullable(),
  allowCustomPrompts: z.boolean(),
  allowNotes: z.boolean().optional().default(false),
  allowSalaryInsight: z.boolean().optional().default(false),
  allowAtsCheck: z.boolean().optional().default(false),
  features: z.array(z.string().trim().max(200)).max(30).optional().default([]),
  status: z.enum(["active", "inactive"]),
});

type PlanData = z.infer<typeof planSchema>;

function clean(v: PlanData) {
  const features = v.features.map((f) => f.trim()).filter(Boolean);
  return {
    name: v.name,
    code: v.code,
    description: v.description ?? "",
    accent: v.accent,
    isFree: v.isFree,
    freeDurationDays: v.isFree ? v.freeDurationDays : 0,
    monthlyPrice: v.isFree ? 0 : v.monthlyPrice,
    yearlyPrice: v.isFree ? 0 : v.yearlyPrice,
    currency: v.currency,
    limitResumes: v.limitResumes,
    allowCustomPrompts: v.allowCustomPrompts,
    allowNotes: v.allowNotes,
    allowSalaryInsight: v.allowSalaryInsight,
    allowAtsCheck: v.allowAtsCheck,
    features,
    status: v.status,
  };
}

/** Keep exactly one free plan active. The default sign-up plan always wins;
 *  otherwise prefer the just-saved plan, then the current active, then the first. */
async function reconcileFreePlans(preferId?: string): Promise<void> {
  const frees = await db
    .select({ id: plans.id, status: plans.status, isDefault: plans.isDefault })
    .from(plans)
    .where(eq(plans.isFree, true));
  if (frees.length === 0) return;
  const def = frees.find((f) => f.isDefault);
  const prefer = preferId ? frees.find((f) => f.id === preferId) : undefined;
  const currentActive = frees.find((f) => f.status === "active");
  const activeId = def
    ? def.id
    : prefer && prefer.status === "active"
      ? prefer.id
      : currentActive
        ? currentActive.id
        : prefer
          ? prefer.id
          : frees[0].id;
  await db.transaction(async (tx) => {
    await tx.update(plans).set({ status: "inactive" }).where(eq(plans.isFree, true));
    await tx.update(plans).set({ status: "active" }).where(eq(plans.id, activeId));
  });
}

/** Set (or clear) the single default sign-up plan. Setting it also activates it. */
async function setDefaultPlan(id: string, want: boolean): Promise<void> {
  if (want) {
    await db.transaction(async (tx) => {
      await tx.update(plans).set({ isDefault: false }).where(ne(plans.id, id));
      await tx.update(plans).set({ isDefault: true, status: "active" }).where(eq(plans.id, id));
    });
  } else {
    await db.update(plans).set({ isDefault: false }).where(eq(plans.id, id));
  }
}

/** Number of users currently assigned to a plan. */
async function usersOnPlan(id: string): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(user).where(eq(user.planId, id));
  return row?.n ?? 0;
}

export async function createPlanAction(input: unknown): Promise<Result> {
  await requireAdmin();
  const p = planSchema.safeParse(input);
  if (!p.success) return fail(p.error);
  const v = clean(p.data);
  if (!v.isFree && v.monthlyPrice <= 0 && v.yearlyPrice <= 0) {
    return { ok: false, error: "A paid plan needs a monthly or a yearly price above 0." };
  }

  const [existing] = await db.select({ id: plans.id }).from(plans).where(eq(plans.code, v.code));
  if (existing) return { ok: false, error: "A plan with that code already exists." };

  const [row] = await db.insert(plans).values(v).returning({ id: plans.id });
  await setDefaultPlan(row.id, p.data.isFree && p.data.isDefault);
  if (v.isFree) await reconcileFreePlans(row.id);
  revalidate();
  return { ok: true };
}

export async function updatePlanAction(id: unknown, input: unknown): Promise<Result> {
  await requireAdmin();
  const planId = z.string().uuid().safeParse(id);
  if (!planId.success) return { ok: false, error: "Invalid plan." };
  const p = planSchema.safeParse(input);
  if (!p.success) return fail(p.error);
  const v = clean(p.data);
  if (!v.isFree && v.monthlyPrice <= 0 && v.yearlyPrice <= 0) {
    return { ok: false, error: "A paid plan needs a monthly or a yearly price above 0." };
  }

  const [current] = await db.select({ id: plans.id }).from(plans).where(eq(plans.id, planId.data));
  if (!current) return { ok: false, error: "Plan not found." };

  // Code is frozen on edit — never changed here.
  const { code: _code, ...set } = v;
  void _code;
  await db.update(plans).set(set).where(eq(plans.id, planId.data));
  await setDefaultPlan(planId.data, p.data.isFree && p.data.isDefault);
  if (v.isFree) await reconcileFreePlans(planId.data);
  revalidate();
  return { ok: true };
}

export async function setPlanStatusAction(id: unknown, status: unknown): Promise<Result> {
  await requireAdmin();
  const planId = z.string().uuid().safeParse(id);
  const s = z.enum(["active", "inactive"]).safeParse(status);
  if (!planId.success || !s.success) return { ok: false, error: "Invalid request." };

  const [plan] = await db.select().from(plans).where(eq(plans.id, planId.data));
  if (!plan) return { ok: false, error: "Plan not found." };

  if (s.data === "inactive") {
    if (plan.isDefault) {
      return { ok: false, error: "Can't deactivate the default sign-up plan — set another plan as the default first." };
    }
    if ((await usersOnPlan(plan.id)) > 0) {
      return { ok: false, error: "Can't deactivate a plan that users are on — move them to another plan first." };
    }
  }

  if (plan.isFree) {
    // Free plans are a radio: you can only activate one (it deactivates the rest);
    // the active free plan can't be switched off directly.
    if (s.data === "inactive") {
      return { ok: false, error: "A free plan must stay active — activate another free plan instead." };
    }
    await db.update(plans).set({ status: "active" }).where(eq(plans.id, planId.data));
    await reconcileFreePlans(planId.data);
  } else {
    await db.update(plans).set({ status: s.data }).where(eq(plans.id, planId.data));
  }
  revalidate();
  return { ok: true };
}

export async function setPlanRecommendedAction(id: unknown, recommended: unknown): Promise<Result> {
  await requireAdmin();
  const planId = z.string().uuid().safeParse(id);
  const r = z.boolean().safeParse(recommended);
  if (!planId.success || !r.success) return { ok: false, error: "Invalid request." };

  if (r.data) {
    // Single-winner: clear everyone else, then set this one.
    await db.transaction(async (tx) => {
      await tx.update(plans).set({ popular: false }).where(ne(plans.id, planId.data));
      await tx.update(plans).set({ popular: true }).where(eq(plans.id, planId.data));
    });
  } else {
    await db.update(plans).set({ popular: false }).where(eq(plans.id, planId.data));
  }
  revalidate();
  return { ok: true };
}

export async function deletePlanAction(id: unknown): Promise<Result> {
  await requireAdmin();
  const planId = z.string().uuid().safeParse(id);
  if (!planId.success) return { ok: false, error: "Invalid plan." };

  const [plan] = await db.select().from(plans).where(eq(plans.id, planId.data));
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.everSubscribed > 0) {
    return { ok: false, error: "Can't delete a plan that's been used — deactivate it instead." };
  }
  if (plan.isDefault) {
    return { ok: false, error: "Can't delete the default sign-up plan. Set another plan as the default first." };
  }
  if (plan.isFree && plan.status === "active") {
    return { ok: false, error: "Can't delete the active free plan. Activate another free plan first." };
  }

  await db.delete(plans).where(eq(plans.id, planId.data));
  if (plan.isFree) await reconcileFreePlans();
  revalidate();
  return { ok: true };
}
