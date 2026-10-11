"use server";

// Public self-registration. Gated on the admin's allowSignup flag; creates the
// user UNVERIFIED on the Free plan, then triggers the verification email. Login is
// blocked until the email is confirmed (requireEmailVerification in lib/auth).

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { account, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { provisionUserDefaults } from "@/lib/provision";
import { getSignupAllowed } from "@/lib/branding";
import { getDefaultPlan, expiryFromAccessDays } from "@/lib/plans";
import { validatePassword } from "@/lib/admin/password-policy-server";

type Result = { ok: true } | { ok: false; error: string };

// Light anti-abuse: cap signups per IP per hour (single-instance, in-memory;
// globalThis-backed so it survives HMR). The email-verification gate is the
// primary protection against fake accounts.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const g = globalThis as unknown as { __signupHits?: Map<string, number[]> };
const hits = (g.__signupHits ??= new Map<string, number[]>());
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_PER_WINDOW) {
    hits.set(ip, arr);
    return true;
  }
  arr.push(now);
  hits.set(ip, arr);
  return false;
}

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string().min(1, "Enter a password."),
});

export async function signUpAction(input: unknown): Promise<Result> {
  // Gate: self-registration must be enabled AND a default sign-up plan must exist.
  const def = await getDefaultPlan();
  if (!(await getSignupAllowed()) || !def) {
    return { ok: false, error: "Registration is currently closed." };
  }

  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Invalid details." };
  const { name, email, password } = p.data;

  // Authoritative password-policy check (mirrors the live client hints).
  const pwErr = await validatePassword(password);
  if (pwErr) return { ok: false, error: pwErr };

  // Rate limit by client IP.
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  if (rateLimited(ip)) {
    return { ok: false, error: "Too many sign-ups from here — please try again later." };
  }

  // Reject duplicates.
  const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (existing.length) {
    return { ok: false, error: "An account with this email already exists. Try logging in." };
  }

  const id = randomUUID();
  const now = new Date();
  await db.insert(user).values({
    id,
    name,
    email,
    emailVerified: false,
    role: "user",
    status: "active",
    planId: def.id,
    planExpiresAt: expiryFromAccessDays(def.freeDurationDays),
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(account).values({
    id: randomUUID(),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: await hashPassword(password),
    createdAt: now,
    updatedAt: now,
  });
  await provisionUserDefaults(id);

  // Issue + send the verification link (Better Auth creates the token; the
  // sendVerificationEmail callback in lib/auth delivers it). Clicking it verifies
  // the email, signs them in, and lands on /leads.
  try {
    await auth.api.sendVerificationEmail({ body: { email, callbackURL: "/leads" }, headers: h });
  } catch (err) {
    // The account exists regardless; log and still report success so the user can
    // use "resend"/"forgot password" if the email didn't arrive.
    console.error("[signup] verification email failed:", err instanceof Error ? err.message : err);
  }

  return { ok: true };
}
