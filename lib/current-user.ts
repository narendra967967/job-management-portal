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
  if (!id) redirect("/");
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
