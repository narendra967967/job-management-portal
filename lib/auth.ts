// Better Auth configuration (Milestone B — reworked).
//
// Login is EMAIL + PASSWORD, admin-provisioned: self sign-up is disabled, so
// only accounts created by an admin (today: the seed / an admin dashboard later)
// can sign in. This deliberately deviates from TRD §8 (which specced Google-only
// login) per the owner's decision.
//
// Google is NOT a login method. It is linked from Settings (account linking) to
// grant read-only Gmail (gmail.readonly, offline) so the sync (Milestone D) can
// fetch job alerts for the logged-in user. Passwords are hashed with scrypt
// (lib/password); nothing is stored in plaintext.

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import { account, session, user, verification } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { provisionUserDefaults } from "@/lib/provision";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    // Admin-provisioned only — no public registration.
    disableSignUp: true,
    minPasswordLength: 8,
    password: {
      hash: hashPassword,
      verify: ({ hash, password }) => verifyPassword(hash, password),
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // Read-only Gmail, captured with a refresh token for the sync (Milestone D).
      scope: ["https://www.googleapis.com/auth/gmail.readonly"],
      accessType: "offline",
      prompt: "consent",
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      // The linked Google account's email may differ from the login email.
      allowDifferentEmails: true,
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
        // Give every newly created user their default settings rows.
        after: async (u) => {
          await provisionUserDefaults(u.id);
        },
      },
    },
  },
  // Must be the last plugin so Server Actions can set auth cookies.
  plugins: [nextCookies()],
});
