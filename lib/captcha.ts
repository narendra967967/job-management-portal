import "server-only";

// Google reCAPTCHA v3 on the sign-in and password pages (user + admin).
//
// Config lives in admin Settings → Security (security_config; secret encrypted).
// When it's on, every guarded request must carry a token that Google scores as
// human (≥ CAPTCHA_MIN_SCORE) for the expected action. If Google can't be
// reached the request is refused (fail closed). Emergency escape hatch — e.g. a
// bad key locking the admin out: set RECAPTCHA_FORCE_OFF=true on the server.
//
// Where it's checked:
//  - Better Auth HTTP endpoints (sign-in, forgot, reset) via captchaGuard() in
//    each auth instance's hooks.before; the token comes in CAPTCHA_HEADER.
//  - Server actions that call auth.api directly (sign-up, reset password) call
//    verifyCaptcha() themselves; direct auth.api calls skip the hook.

import { eq } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { db } from "@/lib/db";
import { securityConfig } from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";

export const CAPTCHA_HEADER = "x-captcha-response";
export const CAPTCHA_MIN_SCORE = 0.5;
const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

export type CaptchaAction =
  | "login"
  | "signup"
  | "forgot_password"
  | "reset_password"
  | "admin_login"
  | "admin_forgot_password"
  | "admin_reset_password"
  | "admin_test";

const forcedOff = () => process.env.RECAPTCHA_FORCE_OFF === "true";

interface ActiveCaptcha {
  siteKey: string;
  secret: string;
}

/** The live config, or null when the check is off / not fully set up. */
async function activeCaptcha(): Promise<ActiveCaptcha | null> {
  if (forcedOff()) return null;
  const [c] = await db
    .select({
      enabled: securityConfig.captchaEnabled,
      siteKey: securityConfig.captchaSiteKey,
      secret: securityConfig.captchaSecretCiphertext,
    })
    .from(securityConfig)
    .where(eq(securityConfig.id, "app"));
  if (!c?.enabled || !c.siteKey || !c.secret) return null;
  return { siteKey: c.siteKey, secret: decryptSecret(c.secret) };
}

/** Site key for the browser, or null when no check is needed. */
export async function captchaSiteKey(): Promise<string | null> {
  try {
    return (await activeCaptcha())?.siteKey ?? null;
  } catch {
    return null;
  }
}

const MSG = {
  missing: "Please allow the security check (Google reCAPTCHA) to load, then try again.",
  failed: "Our security check couldn't confirm you're human. Please try again.",
  unreachable: "We couldn't run the security check right now. Please try again in a moment.",
} as const;

type VerifyResult = { ok: true } | { ok: false; message: string; codes?: string[] };

/** Ask Google about one token. Network problems → unreachable (fail closed). */
export async function siteVerify(
  secret: string,
  token: string,
  action: CaptchaAction,
  ip?: string | null,
): Promise<VerifyResult> {
  let data: { success?: boolean; score?: number; action?: string; "error-codes"?: string[] };
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, message: MSG.unreachable };
    data = await res.json();
  } catch {
    return { ok: false, message: MSG.unreachable };
  }
  if (!data.success) return { ok: false, message: MSG.failed, codes: data["error-codes"] ?? [] };
  if (data.action !== action || (data.score ?? 0) < CAPTCHA_MIN_SCORE) {
    return { ok: false, message: MSG.failed, codes: [`score:${data.score}`, `action:${data.action}`] };
  }
  return { ok: true };
}

/** Verify a token for `action` when the check is on (no-op when it's off). */
export async function verifyCaptcha(
  token: string | null | undefined,
  action: CaptchaAction,
  ip?: string | null,
): Promise<VerifyResult> {
  let cfg: ActiveCaptcha | null;
  try {
    cfg = await activeCaptcha();
  } catch {
    return { ok: false, message: MSG.unreachable };
  }
  if (!cfg) return { ok: true };
  if (!token) return { ok: false, message: MSG.missing };
  const r = await siteVerify(cfg.secret, token, action, ip);
  if (!r.ok) console.warn(`[captcha] ${action} refused`, r.codes ?? "");
  return r;
}

export const USER_CAPTCHA_PATHS: Record<string, CaptchaAction> = {
  "/sign-in/email": "login",
  "/request-password-reset": "forgot_password",
  "/reset-password": "reset_password",
};
export const ADMIN_CAPTCHA_PATHS: Record<string, CaptchaAction> = {
  "/sign-in/email": "admin_login",
  "/request-password-reset": "admin_forgot_password",
  "/reset-password": "admin_reset_password",
};

/** Better Auth hooks.before guard. Only HTTP requests are checked — direct
 *  auth.api calls from our own server code have no `request`. */
export async function captchaGuard(
  ctx: { path: string; request?: Request },
  paths: Record<string, CaptchaAction>,
): Promise<void> {
  const action = paths[ctx.path];
  if (!action || !ctx.request) return;
  const h = ctx.request.headers;
  const r = await verifyCaptcha(h.get(CAPTCHA_HEADER), action, h.get("x-real-ip"));
  if (!r.ok) throw new APIError("FORBIDDEN", { message: r.message, code: "CAPTCHA_FAILED" });
}
