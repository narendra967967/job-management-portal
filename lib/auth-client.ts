"use client";

// Browser-side Better Auth client (same-origin). Used by the login page and the
// log-out controls.

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

/** Start Google sign-in, returning to /leads on success. */
export function signInWithGoogle() {
  return authClient.signIn.social({ provider: "google", callbackURL: "/leads" });
}

/** Sign out and return to the login page. */
export async function signOutToHome() {
  try {
    await authClient.signOut();
  } finally {
    window.location.href = "/";
  }
}
