"use server";

// User-side auth Server Actions. resetPasswordAction enforces the admin-configured
// password policy (Settings → Security) server-side before handing the token to
// Better Auth — the client UI shows the same rules, but the server is authoritative.

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { validatePassword } from "@/lib/admin/password-policy-server";

type Result = { ok: true } | { ok: false; error: string };

export async function resetPasswordAction(token: string, newPassword: string): Promise<Result> {
  if (!token) return { ok: false, error: "This reset link is invalid or has expired." };

  // Full configured policy (length + character classes), not just a min length.
  const pwError = await validatePassword(newPassword);
  if (pwError) return { ok: false, error: pwError };

  try {
    await auth.api.resetPassword({ body: { token, newPassword }, headers: await headers() });
    return { ok: true };
  } catch {
    return { ok: false, error: "This reset link is invalid or has expired. Request a new one." };
  }
}
