"use server";

// Admin Users Server Actions — create / edit / delete / status / reset password.
// Every action requires an admin session. Client-side validation is mirrored here
// with Zod; passwords are scrypt-hashed (never stored plaintext).

import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/current-user";
import { hashPassword } from "@/lib/password";
import { validatePassword } from "@/lib/admin/password-policy-server";
import { provisionUserDefaults } from "@/lib/provision";
import { getDefaultPlan, planExpiryFromNow } from "@/lib/plans";
import { account, plans, supportTickets, user } from "@/db/schema";
import {
  DELETION_CATEGORY,
  deleteUserCompletely,
  fmtDay,
  lastCancelledDeletion,
  openDeletionRequest,
} from "@/lib/account-deletion";

type ActionResult = { ok: true } | { ok: false; error: string; code?: "CANCELLED_REQUEST" };
type CreateResult = { ok: true; emailed: boolean } | { ok: false; error: string };

const roleSchema = z.enum(["user", "admin"]);
const statusSchema = z.enum(["active", "inactive"]);
const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");
const nameSchema = z.string().trim().min(1, "Name is required.").max(120);
const mobileSchema = z.string().trim().max(24).optional().default("");
const planIdSchema = z.string().uuid().nullable().optional();
const passwordSchema = z.string().min(8, "Password must be at least 8 characters.");

const createSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  // Optional: admins don't set a password — the user sets their own via the
  // emailed set-password link. When given, it's still policy-checked.
  password: passwordSchema.optional(),
  mobile: mobileSchema,
  role: roleSchema,
  status: statusSchema,
  planId: planIdSchema,
});

const updateSchema = z.object({
  id: z.string().min(1),
  name: nameSchema,
  mobile: mobileSchema,
  role: roleSchema,
  status: statusSchema,
  planId: planIdSchema,
});

function firstError(e: z.ZodError): string {
  return e.issues[0]?.message ?? "Invalid input.";
}

async function bumpEverSubscribed(planId: string | null | undefined) {
  if (!planId) return;
  await db
    .update(plans)
    .set({ everSubscribed: sql`${plans.everSubscribed} + 1` })
    .where(eq(plans.id, planId));
}

export async function createAdminUserAction(input: unknown): Promise<CreateResult> {
  await requireAdmin();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const v = parsed.data;

  // Registration requires a default sign-up plan to exist (even admin-created).
  const def = await getDefaultPlan();
  if (!def) {
    return { ok: false, error: "Default plan not available — set a default sign-up plan in Plans & Pricing first." };
  }

  // When an admin supplies a password, enforce the configured policy. When they
  // don't (the default), mint an unguessable one — the user replaces it via the
  // emailed set-password link and never sees this value.
  if (v.password) {
    const pwError = await validatePassword(v.password);
    if (pwError) return { ok: false, error: pwError };
  }
  const initialPassword = v.password ?? randomBytes(24).toString("base64url");

  const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, v.email));
  if (existing.length) return { ok: false, error: "A user with that email already exists." };

  // Default to the sign-up plan. Expiry always comes from the plan (no manual date).
  const planId = v.planId ?? def.id;
  const planExpiresAt = await planExpiryFromNow(planId);

  const id = randomUUID();
  await db.insert(user).values({
    id,
    name: v.name,
    email: v.email,
    emailVerified: true,
    mobile: v.mobile || null,
    role: v.role,
    status: v.status,
    planId,
    planExpiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(account).values({
    id: randomUUID(),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: await hashPassword(initialPassword),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await provisionUserDefaults(id);
  await bumpEverSubscribed(planId);

  // Email a welcome + set-password link (best-effort — the account exists either
  // way). The user has never logged in, so sendResetPassword sends the welcome copy.
  let emailed = true;
  try {
    await auth.api.requestPasswordReset({ body: { email: v.email, redirectTo: "/reset-password" } });
  } catch (e) {
    emailed = false;
    console.error("[admin-users] welcome email failed:", e instanceof Error ? e.message : e);
  }

  revalidatePath("/jmp-admin/users");
  return { ok: true, emailed };
}

export async function updateAdminUserAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const v = parsed.data;

  const [current] = await db.select({ planId: user.planId }).from(user).where(eq(user.id, v.id));
  if (!current) return { ok: false, error: "User not found." };

  // Expiry follows the plan: a plan change restarts it from today; keeping the
  // same plan leaves the current expiry untouched.
  const planId = v.planId ?? null;
  const planChanged = planId !== current.planId;
  await db
    .update(user)
    .set({
      name: v.name,
      mobile: v.mobile || null,
      role: v.role,
      status: v.status,
      planId,
      ...(planChanged ? { planExpiresAt: await planExpiryFromNow(planId) } : {}),
    })
    .where(eq(user.id, v.id));

  // Count a newly-assigned plan toward its "ever subscribed" tally.
  if (v.planId && v.planId !== current.planId) await bumpEverSubscribed(v.planId);

  revalidatePath("/jmp-admin/users");
  return { ok: true };
}

export async function setAdminUserStatusAction(id: string, status: unknown): Promise<ActionResult> {
  await requireAdmin();
  const s = statusSchema.safeParse(status);
  if (!s.success) return { ok: false, error: "Invalid status." };
  await db.update(user).set({ status: s.data }).where(eq(user.id, id));
  revalidatePath("/jmp-admin/users");
  return { ok: true };
}

export async function resetAdminUserPasswordAction(id: string, password: unknown): Promise<ActionResult> {
  const adminId = await requireAdmin();
  const p = passwordSchema.safeParse(password);
  if (!p.success) return { ok: false, error: firstError(p.error) };
  const pwError = await validatePassword(p.data);
  if (pwError) return { ok: false, error: pwError };
  void adminId;
  await db
    .update(account)
    .set({ password: await hashPassword(p.data) })
    .where(and(eq(account.userId, id), eq(account.providerId, "credential")));
  revalidatePath("/jmp-admin/users");
  return { ok: true };
}

/** Max days one renewal can add (10 years). */
const RENEW_MAX_DAYS = 3650;

/** Extend a user's plan access by `days`, counted from their current expiry
 *  if it's still ahead, otherwise from now. For manual renewals until payments
 *  exist. Plans that never expire can't be renewed (nothing to extend). */
export async function renewAdminUserAction(id: string, days: unknown): Promise<ActionResult> {
  await requireAdmin();
  const d = z.coerce
    .number()
    .int("Enter whole days.")
    .min(1, "Renew for at least 1 day.")
    .max(RENEW_MAX_DAYS, `Renew for at most ${RENEW_MAX_DAYS} days.`)
    .safeParse(days);
  if (!d.success) return { ok: false, error: firstError(d.error) };

  const [u] = await db
    .select({ planId: user.planId, planExpiresAt: user.planExpiresAt })
    .from(user)
    .where(eq(user.id, id));
  if (!u) return { ok: false, error: "User not found." };
  if (!u.planId) return { ok: false, error: "Assign a plan before renewing." };
  if (!u.planExpiresAt) return { ok: false, error: "This user's plan never expires." };

  const base = Math.max(Date.now(), u.planExpiresAt.getTime());
  await db
    .update(user)
    .set({ planExpiresAt: new Date(base + d.data * 24 * 60 * 60 * 1000) })
    .where(eq(user.id, id));
  revalidatePath("/jmp-admin/users");
  return { ok: true };
}

export async function deleteAdminUserAction(id: string, confirmCancelled = false): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (id === adminId) return { ok: false, error: "You can't delete your own account." };
  // A user who asked to be deleted and then changed their mind: make the admin
  // confirm on purpose (checked now, not when the page loaded).
  if (!confirmCancelled && !(await openDeletionRequest(id))) {
    const cancelled = await lastCancelledDeletion(id);
    if (cancelled) {
      return {
        ok: false,
        code: "CANCELLED_REQUEST",
        error: `This user canceled their account deletion request on ${fmtDay(cancelled)}.`,
      };
    }
  }
  // Everything goes: app data (FK cascades), résumé files on disk, tickets
  // (a deletion-request ticket stays, anonymised) — lib/account-deletion.ts.
  const res = await deleteUserCompletely(id);
  if (!res.ok) return res;
  revalidatePath("/jmp-admin/users");
  revalidatePath("/jmp-admin/tickets");
  return { ok: true };
}

/** "Delete this user" on an Account deletion ticket. Re-checks the request at
 *  the moment of deletion: never acts on a cancelled or already-closed one. */
export async function deleteUserForRequestAction(ticketId: unknown): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (typeof ticketId !== "string" || !/^[0-9a-f-]{36}$/i.test(ticketId)) return { ok: false, error: "Ticket not found." };
  const [t] = await db
    .select({
      userId: supportTickets.userId,
      category: supportTickets.category,
      status: supportTickets.status,
      cancelledAt: supportTickets.cancelledAt,
    })
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId));
  if (!t || t.category !== DELETION_CATEGORY) return { ok: false, error: "This isn't an account deletion request." };
  if (t.cancelledAt) {
    return { ok: false, error: `The user canceled this request on ${fmtDay(t.cancelledAt)} — their account was not deleted.` };
  }
  if (!t.userId) return { ok: false, error: "This account has already been deleted." };
  if (t.status === "resolved") return { ok: false, error: "This request is already closed — reopen it first if the user still wants deletion." };
  if (t.userId === adminId) return { ok: false, error: "You can't delete your own account." };
  const res = await deleteUserCompletely(t.userId);
  if (!res.ok) return res;
  revalidatePath("/jmp-admin/users");
  revalidatePath("/jmp-admin/tickets");
  return { ok: true };
}
