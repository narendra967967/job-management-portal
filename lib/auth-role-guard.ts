// Keeps the two sign-ins apart: the user app (lib/auth.ts, /api/auth) never
// signs in an admin account, and the admin panel (lib/auth-admin.ts,
// /api/admin-auth) never signs in a user account. Both share one user table,
// so without this either side would accept any valid email and password.
//
// No "server-only" import: the Better Auth CLI loads the auth config files.

import { eq, sql } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { db } from "@/lib/db";
import { user } from "@/db/schema";
import { verifyPassword } from "@/lib/password";

export type Side = "user" | "admin";

/** Whether an account with this role may sign in on this side. */
export const roleAllowed = (role: string | null | undefined, side: Side) => (side === "admin" ? role === "admin" : role !== "admin");

export async function roleByEmail(email: unknown): Promise<string | null> {
  if (typeof email !== "string" || !email.trim()) return null;
  const [u] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(sql`lower(${user.email})`, email.trim().toLowerCase()));
  return u ? (u.role ?? "user") : null;
}

export async function roleById(id: string): Promise<string | null> {
  const [u] = await db.select({ role: user.role }).from(user).where(eq(user.id, id));
  return u ? (u.role ?? "user") : null;
}

// A real scrypt hash of a random string, checked against on refusal so a
// refused account takes about as long as a wrong password does.
const DUMMY_HASH = "8c2f1e0b9a7d6c5b4a39281706f5e4d3:" + "0".repeat(128);

/**
 * Refuse a sign-in for the wrong kind of account with exactly the error a
 * wrong password gets, so the form can't be used to learn who is an admin.
 */
export async function refuseWrongSide(email: unknown, side: Side): Promise<void> {
  const role = await roleByEmail(email);
  if (role === null || roleAllowed(role, side)) return;
  await verifyPassword(DUMMY_HASH, "not-the-password").catch(() => false);
  throw new APIError("UNAUTHORIZED", { message: "Invalid email or password", code: "INVALID_EMAIL_OR_PASSWORD" });
}
