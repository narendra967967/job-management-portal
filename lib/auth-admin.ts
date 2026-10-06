// Separate Better Auth instance for the ADMIN panel. It shares the same database
// (user/session/account) but uses its OWN cookie prefix and API base path, so the
// admin session is completely independent from the user-dashboard session — both
// can be logged in, in the same browser, without clobbering each other.

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { account, session, user, verification } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { getSessionLengthSeconds } from "@/lib/session-length";

// Same session length as the user side (Settings → Security), read once at init
// so the admin session + cookie expire together. Applies on new logins after a
// server restart.
const SESSION_SECONDS = await getSessionLengthSeconds();

export const authAdmin = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  // Own endpoints + own cookie → isolated from the user session.
  basePath: "/api/admin-auth",
  advanced: {
    cookiePrefix: "jmp-admin",
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    password: {
      hash: hashPassword,
      verify: ({ hash, password }) => verifyPassword(hash, password),
    },
  },
  user: {
    additionalFields: {
      mobile: { type: "string", required: false },
      role: { type: "string", required: false, defaultValue: "user", input: false },
      status: { type: "string", required: false, defaultValue: "active", input: false },
      planId: { type: "string", required: false, input: false },
      planExpiresAt: { type: "date", required: false, input: false },
    },
  },
  session: {
    // One value drives both the DB session and the cookie max-age (they expire
    // together); updateAge == expiresIn disables the sliding refresh.
    expiresIn: SESSION_SECONDS,
    updateAge: SESSION_SECONDS,
  },
  databaseHooks: {
    session: {
      create: {
        after: async (s) => {
          await db.update(user).set({ lastLoginAt: new Date() }).where(eq(user.id, s.userId));
        },
      },
    },
  },
  plugins: [nextCookies()],
});
