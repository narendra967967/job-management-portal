// Better Auth configuration.
//
// PHASE 2 SCOPE: this exists so Better Auth can generate its canonical auth
// tables (user/session/account/verification) into db/auth-schema.ts, which the
// app tables then FK to. Auth is NOT enforced yet — the handler route,
// middleware session checks, and the single-email allow-list are Phase 3
// (TRD §11: "turns on auth enforcement").
//
// Sign-in is Google OAuth only (TRD §8) — no password anywhere. Phase 3 adds
// the gmail.readonly scope + offline access so one consent screen covers both
// login and read-only Gmail (TRD §2).

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  // The user's mobile number is edited in Settings → Profile (Phase 1), so the
  // user table carries it as an extra field.
  user: {
    additionalFields: {
      mobile: { type: "string", required: false },
    },
  },
});
