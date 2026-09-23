"use client";

// Browser-side Better Auth client (same-origin). Login is email+password;
// Google is linked/unlinked from Settings for Gmail access only.

import { createAuthClient } from "better-auth/react";
import { clearSessionPersistedState } from "@/lib/use-persistent-state";

export const authClient = createAuthClient();

/** Email + password sign-in. Returns { error } on failure. */
export function signInEmail(
  email: string,
  password: string,
  rememberMe = true,
) {
  return authClient.signIn.email({ email, password, rememberMe });
}

/** Request a password-reset email; the link lands on /reset-password. */
export function requestPasswordReset(email: string) {
  return authClient.requestPasswordReset({
    email,
    redirectTo: "/reset-password",
  });
}

/** Set a new password using the token from the reset link. */
export function resetPassword(token: string, newPassword: string) {
  return authClient.resetPassword({ token, newPassword });
}

/** Change the signed-in user's password (verifies the current one). */
export function changePassword(currentPassword: string, newPassword: string) {
  return authClient.changePassword({
    currentPassword,
    newPassword,
    revokeOtherSessions: true,
  });
}

/** Link the current user's Google account (read-only Gmail), returning to
 *  Settings. Requires GOOGLE_CLIENT_ID/SECRET to be configured. */
export function connectGoogle() {
  return authClient.linkSocial({
    provider: "google",
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    callbackURL: "/settings",
  });
}

/** Sign out and return to the login page. */
export async function signOutToHome() {
  try {
    await authClient.signOut();
  } finally {
    // Reset session-scoped UI state (filters) so the next login starts clean.
    clearSessionPersistedState();
    window.location.href = "/";
  }
}
