import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// The acting user for data-layer reads/writes. Login is email+password
// (Better Auth), always enforced — no external dependency, so no dev bypass.

/** The signed-in user's id, or null when there's no valid session. */
export async function getSessionUserId(): Promise<string | null> {
  const s = await auth.api.getSession({ headers: await headers() });
  return s?.user?.id ?? null;
}

/** The signed-in user's id, redirecting to the login page when unauthenticated.
 *  Use in dashboard reads and Server Actions. */
export async function getCurrentUserId(): Promise<string> {
  const id = await getSessionUserId();
  if (!id) redirect("/");
  return id;
}

/** Whether Google OAuth is configured, so the Settings "Connect Google" (Gmail
 *  linking) can work. Login does not depend on this. */
export function googleConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}
