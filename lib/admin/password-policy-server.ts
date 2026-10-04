import "server-only";

// Server-side enforcement of the admin-configured password policy. The client
// PasswordField (lib/admin/password-policy) shows these rules live; this is the
// authoritative check so the policy still holds if the client is bypassed.
// Rules mirror rulesFor()/isPasswordValid() in lib/admin/password-policy.

import { db } from "@/lib/db";
import { securityConfig } from "@/db/schema";

export interface ServerPasswordPolicy {
  minLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
}

/** Read the live policy from security_config (same fallbacks as settings-data). */
export async function getServerPasswordPolicy(): Promise<ServerPasswordPolicy> {
  const [s] = await db.select().from(securityConfig).limit(1);
  return {
    minLength: s?.pwMinLength ?? 8,
    requireUpper: s?.pwRequireUpper ?? true,
    requireLower: s?.pwRequireLower ?? true,
    requireNumber: s?.pwRequireNumber ?? true,
    requireSpecial: s?.pwRequireSpecial ?? true,
  };
}

/** Returns an error message if the password violates the policy, else null. */
export function checkPasswordAgainstPolicy(pw: string, p: ServerPasswordPolicy): string | null {
  if (pw.length < p.minLength) return `Password must be at least ${p.minLength} characters.`;
  if (p.requireUpper && !/[A-Z]/.test(pw)) return "Password must include an uppercase letter.";
  if (p.requireLower && !/[a-z]/.test(pw)) return "Password must include a lowercase letter.";
  if (p.requireNumber && !/\d/.test(pw)) return "Password must include a number.";
  if (p.requireSpecial && !/[^A-Za-z0-9]/.test(pw)) return "Password must include a special character.";
  return null;
}

/** Convenience: read the live policy and validate `pw` against it. */
export async function validatePassword(pw: string): Promise<string | null> {
  return checkPasswordAgainstPolicy(pw, await getServerPasswordPolicy());
}
