// Shared password policy — the single source of truth for the PasswordField rules
// AND the admin Security settings, so editing the policy updates the live checks.
// Session-only mock store for now; swap for a DB-backed value when auth is wired.

import { useSyncExternalStore } from "react";

export interface PasswordPolicy {
  minLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUpper: true,
  requireLower: true,
  requireNumber: true,
  requireSpecial: true,
};

let current: PasswordPolicy = { ...DEFAULT_PASSWORD_POLICY };
const listeners = new Set<() => void>();

export function getPasswordPolicy(): PasswordPolicy {
  return current;
}
export function setPasswordPolicy(policy: PasswordPolicy): void {
  current = { ...policy };
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
/** React hook — re-renders when the policy changes (so rule lists stay in sync). */
export function usePasswordPolicy(): PasswordPolicy {
  return useSyncExternalStore(subscribe, getPasswordPolicy, getPasswordPolicy);
}

export interface PwRule {
  label: string;
  test: (pw: string) => boolean;
}

export function rulesFor(policy: PasswordPolicy): PwRule[] {
  const rules: PwRule[] = [
    { label: `At least ${policy.minLength} characters`, test: (p) => p.length >= policy.minLength },
  ];
  if (policy.requireUpper) rules.push({ label: "An uppercase letter (A–Z)", test: (p) => /[A-Z]/.test(p) });
  if (policy.requireLower) rules.push({ label: "A lowercase letter (a–z)", test: (p) => /[a-z]/.test(p) });
  if (policy.requireNumber) rules.push({ label: "A number (0–9)", test: (p) => /\d/.test(p) });
  if (policy.requireSpecial) rules.push({ label: "A special character", test: (p) => /[^A-Za-z0-9]/.test(p) });
  return rules;
}

export function isPasswordValid(pw: string, policy: PasswordPolicy = current): boolean {
  return rulesFor(policy).every((r) => r.test(pw));
}
