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
import { account, securityConfig, session, user, verification } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { provisionUserDefaults } from "@/lib/provision";
import { sendMail, SMTP_NOT_CONFIGURED } from "@/lib/mailer";

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
    sendResetPassword: async ({ user, url }) => {
      const subject = "Reset your Job Management Portal password";
      const html = `<p>We received a request to reset your password.</p>
<p><a href="${url}">Reset your password</a> — this link expires in 1 hour.</p>
<p>If you didn't request this, you can ignore this email.</p>`;
      try {
        await sendMail({
          to: user.email,
          subject,
          html,
          text: `Reset your password: ${url}`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === SMTP_NOT_CONFIGURED) {
          console.log(
            `\n[password-reset] SMTP not configured — reset link for ${user.email}:\n${url}\n`,
          );
        } else {
          console.error("[password-reset] email send failed:", msg);
          console.log(`[password-reset] link for ${user.email}: ${url}`);
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
    // The real per-session lifetime is set at create time from the admin's
    // Security setting (see databaseHooks.session.create.before). These act as a
    // generous ceiling and disable the sliding refresh, so the create-time
    // expiry is what actually governs how long a login stays valid.
    expiresIn: 60 * 60 * 24 * 365,
    updateAge: 60 * 60 * 24 * 365,
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
        // Apply the admin-configured session length to this login.
        before: async (s) => {
          const [sec] = await db
            .select({ value: securityConfig.sessionValue, unit: securityConfig.sessionUnit })
            .from(securityConfig)
            .limit(1);
          const value = sec?.value ?? 7;
          const unit = sec?.unit ?? "days";
          const ms = unit === "hours" ? value * 3_600_000 : value * 86_400_000;
          return { data: { ...s, expiresAt: new Date(Date.now() + ms) } };
        },
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
