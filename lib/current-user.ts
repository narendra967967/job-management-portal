import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { authAdmin } from "@/lib/auth-admin";

// The acting user for data-layer reads/writes. Login is email+password
// (Better Auth), always enforced — no external dependency, so no dev bypass.

/** The signed-in user's id, or null when there's no valid session. */
export async function getSessionUserId(): Promise<string | null> {
  const s = await auth.api.getSession({ headers: await headers() });
  return s?.user?.id ?? null;
}

/** The signed-in user's id, redirecting to the login page when unauthenticated.
 *  Use in dashboard reads and Server Actions. (Admin accounts are kept out of the
 *  user app at the login step, not here, to avoid redirect loops with "/".) */
export async function getCurrentUserId(): Promise<string> {
  const id = await getSessionUserId();
  if (!id) redirect("/login");
  return id;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  role: string;
  status: string;
  planExpiresAt: Date | null;
}

/** The full signed-in user (user-app session), or null. No redirect. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const s = await auth.api.getSession({ headers: await headers() });
  const u = s?.user as
    | { id?: string; name?: string; email?: string; mobile?: string | null; role?: string; status?: string; planExpiresAt?: string | Date | null }
    | undefined;
  if (!u?.id) return null;
  return {
    id: u.id,
    name: u.name ?? "",
    email: u.email ?? "",
    mobile: u.mobile ?? null,
    role: u.role ?? "user",
    status: u.status ?? "active",
    planExpiresAt: u.planExpiresAt ? new Date(u.planExpiresAt) : null,
  };
}

export type AccessState = "ok" | "deactivated" | "expired";

/** Whether a user may use the dashboard, or is deactivated / past their plan expiry. */
export function accessState(u: { status: string; planExpiresAt: Date | null }): AccessState {
  if (u.status === "inactive") return "deactivated";
  if (u.planExpiresAt && u.planExpiresAt.getTime() < Date.now()) return "expired";
  return "ok";
}

/** Paths an expired user (limited mode) may still open: Upgrade Plan, Help &
 *  support, guides, and Settings (which itself shows only Help + Account). */
export const LIMITED_MODE_PATHS = ["/upgrade", "/settings", "/support", "/guides"];

export function allowedInLimitedMode(pathname: string): boolean {
  return LIMITED_MODE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** The signed-in user's id for FEATURE actions (leads, AI, notes…): refuses
 *  when the plan has expired (limited mode) or the account is deactivated.
 *  Account, help and payment actions use getCurrentUserId / getSessionUser. */
export async function getActiveUserId(): Promise<string> {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  const state = accessState(u);
  if (state === "expired") throw new Error("Your plan has ended. Pick a plan on Upgrade Plan to keep going.");
  if (state === "deactivated") throw new Error("This account is deactivated.");
  return u.id;
}

/** The signed-in admin's id, redirecting to the admin login when the session is
 *  missing or the account isn't an admin. Use in admin loaders + Server Actions. */
export async function requireAdmin(): Promise<string> {
  // The admin session lives in its OWN cookie (authAdmin), independent of the
  // user-dashboard session.
  const s = await authAdmin.api.getSession({ headers: await headers() });
  const u = s?.user as { id?: string; role?: string } | undefined;
  if (!u?.id || u.role !== "admin") redirect("/jmp-admin/login");
  return u.id;
}

/** Whether Google OAuth is configured, so the Settings "Connect Google" (Gmail
 *  linking) can work. Login does not depend on this. */
export function googleConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}
