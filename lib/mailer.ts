import "server-only";

// Outbound system email via SMTP. Config lives in the DB (smtp_config, one "app"
// row) so a future admin dashboard can manage it; the SMTP password is
// encrypted at rest. When SMTP isn't configured/enabled, callers fall back to
// logging the link (dev-friendly, no email needed).

import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { smtpConfig } from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";

export const SMTP_NOT_CONFIGURED = "SMTP_NOT_CONFIGURED";

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface ResolvedSmtp {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  fromEmail: string;
  fromName?: string;
}

/**
 * Resolve SMTP settings: the DB row (admin-managed, encrypted password) takes
 * precedence; otherwise fall back to environment variables. Returns null when
 * neither is set (callers then log the reset link instead).
 *
 * Env fallback keys: SMTP_HOST, SMTP_PORT (default 587), SMTP_SECURE ("true"),
 * SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_FROM_NAME.
 */
async function resolveConfig(): Promise<ResolvedSmtp | null> {
  const [c] = await db
    .select()
    .from(smtpConfig)
    .where(eq(smtpConfig.id, "app"))
    .limit(1);
  // App passwords (e.g. Gmail) are shown with spaces — strip them.
  const clean = (v?: string | null) => v?.replace(/\s+/g, "") || undefined;

  if (c && c.enabled && c.host && c.fromEmail) {
    return {
      host: c.host,
      port: c.port,
      secure: c.secure,
      user: c.username ?? undefined,
      pass: c.passwordCiphertext
        ? clean(decryptSecret(c.passwordCiphertext))
        : undefined,
      fromEmail: c.fromEmail,
      fromName: c.fromName ?? undefined,
    };
  }

  const host = process.env.SMTP_HOST;
  const fromEmail = process.env.SMTP_FROM;
  if (host && fromEmail) {
    return {
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER || undefined,
      pass: clean(process.env.SMTP_PASS),
      fromEmail,
      fromName: process.env.SMTP_FROM_NAME || undefined,
    };
  }

  return null;
}

/** True when SMTP is set up (DB row or env). */
export async function isMailConfigured(): Promise<boolean> {
  return (await resolveConfig()) !== null;
}

/** Send an email. Throws SMTP_NOT_CONFIGURED when SMTP isn't set up. */
export async function sendMail(input: MailInput): Promise<void> {
  const c = await resolveConfig();
  if (!c) throw new Error(SMTP_NOT_CONFIGURED);

  const transport = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: c.user && c.pass ? { user: c.user, pass: c.pass } : undefined,
  });

  await transport.sendMail({
    from: c.fromName ? `${c.fromName} <${c.fromEmail}>` : c.fromEmail,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
}
