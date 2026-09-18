// Better Auth configuration (Milestone B).
//
// Sign-in is Google OAuth only (TRD §8) — no password anywhere. One consent
// screen requests identity + read-only Gmail (gmail.readonly, offline) so the
// refresh token is captured now and reused by the Gmail sync in Milestone D.
//
// Single-user guard: sign-in is restricted server-side to ALLOWED_EMAIL — any
// other Google account is rejected before an account is created.
//
// Auth only actually enforces when Google credentials are configured (see
// lib/current-user.ts `authEnabled`). Until then the app runs against the seeded
// dev user so local development isn't blocked on OAuth setup.

import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import { account, session, user, verification } from "@/db/schema";

const allowedEmail = process.env.ALLOWED_EMAIL?.trim().toLowerCase();

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // Identity (openid/email/profile, added by default) + read-only Gmail.
      scope: ["https://www.googleapis.com/auth/gmail.readonly"],
      accessType: "offline",
      prompt: "consent",
    },
  },
  user: {
    additionalFields: {
      mobile: { type: "string", required: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // The single-user allow-list: only ALLOWED_EMAIL can ever create an
        // account. Any other Google account is rejected at sign-in.
        before: async (u) => {
          if (allowedEmail && u.email.trim().toLowerCase() !== allowedEmail) {
            throw new APIError("FORBIDDEN", {
              message: "This app is restricted to a single authorized account.",
            });
          }
          return { data: u };
        },
      },
    },
  },
  // Must be the last plugin so Server Actions can set auth cookies.
  plugins: [nextCookies()],
});
