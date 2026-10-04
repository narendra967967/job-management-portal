"use server";

// Admin Users Server Actions — create / edit / delete / status / reset password.
// Every action requires an admin session. Client-side validation is mirrored here
// with Zod; passwords are scrypt-hashed (never stored plaintext).

import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/current-user";
import { hashPassword } from "@/lib/password";
import { validatePassword } from "@/lib/admin/password-policy-server";
import { provisionUserDefaults } from "@/lib/provision";
import { account, plans, user } from "@/db/schema";

type ActionResult = { ok: true } | { ok: false; error: string };

const roleSchema = z.enum(["user", "admin"]);
const statusSchema = z.enum(["active", "inactive"]);
const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");
const nameSchema = z.string().trim().min(1, "Name is required.").max(120);
const mobileSchema = z.string().trim().max(24).optional().default("");
const planIdSchema = z.string().uuid().nullable().optional();
const expiresSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date.")
  .nullable()
  .optional();
const passwordSchema = z.string().min(8, "Password must be at least 8 characters.");

const createSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  mobile: mobileSchema,
  role: roleSchema,
  status: statusSchema,
  planId: planIdSchema,
  expiresAt: expiresSchema,
});

const updateSchema = z.object({
  id: z.string().min(1),
  name: nameSchema,
  mobile: mobileSchema,
  role: roleSchema,
  status: statusSchema,
  planId: planIdSchema,
  expiresAt: expiresSchema,
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

export async function createAdminUserAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const v = parsed.data;

  // Enforce the admin-configured password policy server-side (not just min length).
  const pwError = await validatePassword(v.password);
  if (pwError) return { ok: false, error: pwError };

  const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, v.email));
  if (existing.length) return { ok: false, error: "A user with that email already exists." };

  const id = randomUUID();
  await db.insert(user).values({
    id,
    name: v.name,
    email: v.email,
    emailVerified: true,
    mobile: v.mobile || null,
    role: v.role,
    status: v.status,
    planId: v.planId ?? null,
    planExpiresAt: v.expiresAt ? new Date(v.expiresAt) : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(account).values({
    id: randomUUID(),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: await hashPassword(v.password),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await provisionUserDefaults(id);
  await bumpEverSubscribed(v.planId ?? null);

  revalidatePath("/jmp-admin/users");
  return { ok: true };
}

export async function updateAdminUserAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const v = parsed.data;

  const [current] = await db.select({ planId: user.planId }).from(user).where(eq(user.id, v.id));
  if (!current) return { ok: false, error: "User not found." };

  await db
    .update(user)
    .set({
      name: v.name,
      mobile: v.mobile || null,
      role: v.role,
      status: v.status,
      planId: v.planId ?? null,
      planExpiresAt: v.expiresAt ? new Date(v.expiresAt) : null,
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

export async function deleteAdminUserAction(id: string): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (id === adminId) return { ok: false, error: "You can't delete your own account." };
  // Cascades to the user's app data + auth rows via FK on delete.
  await db.delete(user).where(eq(user.id, id));
  revalidatePath("/jmp-admin/users");
  return { ok: true };
}
