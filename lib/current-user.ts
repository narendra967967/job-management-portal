import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Resolves the acting user's id for data-layer reads/writes.
//
// Auth ENFORCES only when Google credentials are configured. Until then (local
// dev without an OAuth client yet) we fall back to the seeded dev user so the
// app is fully usable. Once GOOGLE_CLIENT_ID/SECRET are set, a real Better Auth
// session is required and the single-email allow-list (lib/auth.ts) applies.

/** True when Google OAuth is configured, so real auth should be enforced. */
export function authEnabled(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

/** The signed-in user's id, or null. Falls back to the dev user when auth is off. */
export async function getSessionUserId(): Promise<string | null> {
  if (!authEnabled()) {
    return process.env.DEV_USER_ID ?? "dev-user";
  }
  const s = await auth.api.getSession({ headers: await headers() });
  return s?.user?.id ?? null;
}

/** Like getSessionUserId, but redirects to the login page when unauthenticated
 *  (auth enabled + no session). Use in dashboard reads and Server Actions. */
export async function getCurrentUserId(): Promise<string> {
  const id = await getSessionUserId();
  if (!id) redirect("/");
  return id;
}
