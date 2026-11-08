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
import { APIError, createAuthMiddleware } from "better-auth/api";
import { captchaGuard, USER_CAPTCHA_PATHS } from "@/lib/captcha";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { account, emailIntakeConfig, session, user, verification } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { provisionUserDefaults } from "@/lib/provision";
import { SMTP_NOT_CONFIGURED } from "@/lib/email";
import { sendTemplateEmail } from "@/lib/email-templates";
import { greetingName } from "@/lib/email-templates-model";
import { getSessionLengthSeconds } from "@/lib/session-length";

// Read once at init: drives BOTH the DB session expiry and the cookie max-age so
// they always match. Changing Settings → Security applies on new logins after a
// server restart.
const SESSION_SECONDS = await getSessionLengthSeconds();

/** How long an email confirmation link works. */
const VERIFY_LINK_HOURS = 24;

// Signing in while unverified sends a fresh link (sendOnSignIn), so a user who
// lost the first one isn't stuck. This stops repeated attempts from filling
// their inbox: one link per address per few minutes.
const VERIFY_RESEND_MS = 3 * 60_000;
const g = globalThis as unknown as { __verifySentAt?: Map<string, number> };
const verifySentAt = (g.__verifySentAt ??= new Map<string, number>());

/** Admin "Connect Gmail" switch (Settings → Email intake). Queried here rather
 *  than via lib/email-intake-data, which is server-only and so can't load in the
 *  Better Auth CLI. A missing row means the default (on). */
async function gmailLinkingAllowed(): Promise<boolean> {
  const [row] = await db
    .select({ on: emailIntakeConfig.gmailOAuthEnabled })
    .from(emailIntakeConfig)
    .where(eq(emailIntakeConfig.id, "app"));
  return row ? row.on : true;
}

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    // The public sign-up endpoint stays disabled; self-registration goes through
    // actions/signup.ts, which gates on the admin's allowSignup flag + password
    // policy and creates the user UNVERIFIED. requireEmailVerification then blocks
    // sign-in until the email is confirmed. Admin-created users start unverified
    // too, and setting their password from the welcome link verifies them.
    disableSignUp: true,
    requireEmailVerification: true,
    // A password set through an emailed link proves the user owns the address.
    onPasswordReset: async ({ user: who }) => {
      if (!who.emailVerified) {
        await db.update(user).set({ emailVerified: true, updatedAt: new Date() }).where(eq(user.id, who.id));
      }
    },
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
      // Wording: admin Engagement → Email templates.
      try {
        await sendTemplateEmail(isNew ? "welcome_set_password" : "reset_password", {
          to: recipient.email,
          values: { user_name: greetingName(recipient.name), user_email: recipient.email },
          buttonUrl: url,
        });
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
  emailVerification: {
    // Clicking the link verifies the email AND signs the user in, landing them on
    // the dashboard. actions/signup.ts triggers the send after creating the account.
    autoSignInAfterVerification: true,
    sendOnSignIn: true,
    expiresIn: VERIFY_LINK_HOURS * 60 * 60,
    sendVerificationEmail: async ({ user: recipient, url }) => {
      const key = recipient.email.toLowerCase();
      const last = verifySentAt.get(key) ?? 0;
      if (Date.now() - last < VERIFY_RESEND_MS) return;
      verifySentAt.set(key, Date.now());
      try {
        await sendTemplateEmail("verify_email", {
          to: recipient.email,
          values: {
            user_name: greetingName(recipient.name),
            user_email: recipient.email,
            link_hours: String(VERIFY_LINK_HOURS),
          },
          buttonUrl: url,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === SMTP_NOT_CONFIGURED) {
          console.log(`\n[verify-email] SMTP not configured — link for ${recipient.email}:\n${url}\n`);
        } else {
          console.error("[verify-email] email send failed:", msg);
          console.log(`[verify-email] link for ${recipient.email}: ${url}`);
        }
      }
    },
  },
  advanced: {
    // Client IP for rate limiting / session tracking: only Nginx's X-Real-IP
    // ($remote_addr, overwritten on every request). X-Forwarded-For can carry
    // values the client made up, which would let it dodge the login limit.
    ipAddress: { ipAddressHeaders: ["x-real-ip"] },
  },
  // Production only (the library's default). Sign-in is stricter than its
  // built-in 3 per 10 s (≈26k guesses/day/IP): 5 per minute per IP.
  rateLimit: {
    customRules: { "/sign-in/email": { window: 60, max: 5 } },
  },
  account: {
    // Google access/refresh tokens are encrypted at rest (keyed by
    // BETTER_AUTH_SECRET). Read them only through auth.api.getAccessToken
    // (lib/gmail.ts), which decrypts and refreshes. Tokens stored before this
    // was enabled are plaintext and still readable; reconnecting re-encrypts.
    encryptOAuthTokens: true,
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
      // Set from Settings → Profile (Server Action), not via the auth API.
      country: { type: "string", required: false, input: false },
      // Admin-managed fields (not settable via the auth API — input: false).
      role: { type: "string", required: false, defaultValue: "user", input: false },
      status: { type: "string", required: false, defaultValue: "active", input: false },
      planId: { type: "string", required: false, input: false },
      planExpiresAt: { type: "date", required: false, input: false },
    },
  },
  hooks: {
    // While the admin has Connect Gmail switched off, Google can't be linked:
    // refuse both starting the link and finishing an OAuth round-trip that was
    // already under way when the switch flipped.
    before: createAuthMiddleware(async (ctx) => {
      // reCAPTCHA on sign-in / forgot / reset (no-op while it's switched off).
      await captchaGuard(ctx, USER_CAPTCHA_PATHS);
      if (ctx.path !== "/link-social" && !ctx.path.startsWith("/callback/")) return;
      if (!(await gmailLinkingAllowed())) {
        throw new APIError("FORBIDDEN", { message: "Connect Gmail is turned off." });
      }
    }),
  },
  databaseHooks: {
    // Backstop for the same rule at the storage layer.
    account: {
      create: {
        before: async (a) => {
          if (a.providerId === "google" && !(await gmailLinkingAllowed())) return false;
        },
      },
    },
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
