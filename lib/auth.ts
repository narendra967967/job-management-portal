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
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { account, session, user, verification } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { provisionUserDefaults } from "@/lib/provision";
import { sendAppEmail, SMTP_NOT_CONFIGURED } from "@/lib/email";
import { getAppName } from "@/lib/branding";
import { getSessionLengthSeconds } from "@/lib/session-length";

// Read once at init: drives BOTH the DB session expiry and the cookie max-age so
// they always match. Changing Settings → Security applies on new logins after a
// server restart.
const SESSION_SECONDS = await getSessionLengthSeconds();

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
    // Reset link is emailed via SMTP (config in DB). When SMTP isn't set up
    // yet, log the link so the flow is testable locally without email.
    // Admin-provisioned accounts that have never logged in get a WELCOME email
    // (with the same set-password link); existing users get the reset copy.
    sendResetPassword: async ({ user: recipient, url }) => {
      const appName = await getAppName();
      let isNew = false;
      try {
        const [row] = await db
          .select({ lastLoginAt: user.lastLoginAt })
          .from(user)
          .where(eq(user.id, recipient.id));
        isNew = !row?.lastLoginAt;
      } catch {
        isNew = false;
      }
      const content = isNew
        ? {
            subject: `Welcome to ${appName} — set your password`,
            heading: `Welcome to ${appName}`,
            lines: [
              `Hi ${recipient.name || "there"}, an administrator created an account for you on ${appName}.`,
              `Your login ID is ${recipient.email}.`,
              "Click below to set your password and sign in. This link expires in 1 hour — if it does, use “Forgot password” on the sign-in page to get a new one.",
            ],
            button: { label: "Set your password", url },
            footerNote:
              "Once you're signed in, you can change your password anytime from Settings → Account.",
          }
        : {
            subject: `Reset your ${appName} password`,
            heading: "Reset your password",
            lines: [
              `We received a request to reset your ${appName} password.`,
              "Click the button below to choose a new one — this link expires in 1 hour.",
            ],
            button: { label: "Reset your password", url },
            footerNote: "If you didn't request this, you can safely ignore this email.",
          };
      try {
        await sendAppEmail({ to: recipient.email, ...content });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === SMTP_NOT_CONFIGURED) {
          console.log(
            `\n[password-reset] SMTP not configured — link for ${recipient.email}:\n${url}\n`,
          );
        } else {
          console.error("[password-reset] email send failed:", msg);
          console.log(`[password-reset] link for ${recipient.email}: ${url}`);
        }
      }
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
  session: {
    // Both the DB session and the cookie max-age come from this one value, so a
    // login's lifetime and its cookie expire together. updateAge == expiresIn
    // disables the sliding refresh (fixed window from login).
    expiresIn: SESSION_SECONDS,
    updateAge: SESSION_SECONDS,
  },
  user: {
    additionalFields: {
      mobile: { type: "string", required: false },
      // Admin-managed fields (not settable via the auth API — input: false).
      role: { type: "string", required: false, defaultValue: "user", input: false },
      status: { type: "string", required: false, defaultValue: "active", input: false },
      planId: { type: "string", required: false, input: false },
      planExpiresAt: { type: "date", required: false, input: false },
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
    session: {
      create: {
        // Record the login time so "last login" survives logout/expiry.
        after: async (s) => {
          await db.update(user).set({ lastLoginAt: new Date() }).where(eq(user.id, s.userId));
        },
      },
    },
  },
  // Must be the last plugin so Server Actions can set auth cookies.
  plugins: [nextCookies()],
});
