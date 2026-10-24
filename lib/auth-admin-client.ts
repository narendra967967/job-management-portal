"use client";

// Browser client for the ADMIN auth instance (separate cookie + /api/admin-auth).
// Keeps the admin session independent from the user-dashboard session.

import { captchaFetchOptions } from "@/components/auth/use-recaptcha";
import { createAuthClient } from "better-auth/react";

export const adminAuthClient = createAuthClient({ basePath: "/api/admin-auth" });

/** Email + password sign-in for the admin panel. Returns { data, error }. */
export function adminSignInEmail(email: string, password: string, captchaToken = "") {
  return adminAuthClient.signIn.email({
    email,
    password,
    rememberMe: true,
    fetchOptions: captchaFetchOptions(captchaToken),
  });
}

/** End the admin session (does not touch the user-dashboard session). */
export function adminSignOut() {
  return adminAuthClient.signOut();
}
