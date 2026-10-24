"use server";

// User-side auth Server Actions. resetPasswordAction enforces the admin-configured
// password policy (Settings → Security) server-side before handing the token to
// Better Auth — the client UI shows the same rules, but the server is authoritative.

import { verifyCaptcha } from "@/lib/captcha";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { validatePassword } from "@/lib/admin/password-policy-server";

type Result = { ok: true } | { ok: false; error: string };

export async function resetPasswordAction(
  token: string,
  newPassword: string,
  captchaToken?: string,
): Promise<Result> {
  if (!token) return { ok: false, error: "This reset link is invalid or has expired." };

  // reCAPTCHA (no-op while it's switched off in admin Settings → Security).
  const h = await headers();
  const human = await verifyCaptcha(
    typeof captchaToken === "string" ? captchaToken : "",
    "reset_password",
    h.get("x-real-ip"),
  );
  if (!human.ok) return { ok: false, error: human.message };

  // Full configured policy (length + character classes), not just a min length.
  const pwError = await validatePassword(newPassword);
  if (pwError) return { ok: false, error: pwError };

  try {
    await auth.api.resetPassword({ body: { token, newPassword }, headers: h });
    return { ok: true };
  } catch {
    return { ok: false, error: "This reset link is invalid or has expired. Request a new one." };
  }
}
