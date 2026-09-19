"use client";

// Browser-side Better Auth client (same-origin). Login is email+password;
// Google is linked/unlinked from Settings for Gmail access only.

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

/** Email + password sign-in. Returns { error } on failure. */
export function signInEmail(email: string, password: string) {
  return authClient.signIn.email({ email, password });
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
    window.location.href = "/";
  }
}
