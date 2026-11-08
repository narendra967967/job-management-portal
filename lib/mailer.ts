import "server-only";

// Outbound system email. Every email the app sends comes through sendMail(),
// which uses the service chosen in admin Settings → Email delivery: SMTP
// (smtp_config) or Amazon SES (email_delivery, lib/ses.ts). There's no automatic
// fallback between them: an email the chosen service can't send fails. Secrets
// are encrypted at rest. When email isn't set up, callers get SMTP_NOT_CONFIGURED
// and fall back to logging the link (dev-friendly, no email needed).

import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { smtpConfig } from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";
import { getEmailProvider, getSesCredentials } from "@/lib/email-delivery";
import type { EmailProvider } from "@/lib/email-delivery-model";
import { sesTransportOptions } from "@/lib/ses";

/** Email isn't set up for the chosen service (the name predates Amazon SES). */
export const SMTP_NOT_CONFIGURED = "SMTP_NOT_CONFIGURED";

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Extra headers, e.g. List-Unsubscribe on promotional email. */
  headers?: Record<string, string>;
}

interface ResolvedSmtp {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
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
      replyTo: c.replyTo ?? undefined,
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

/** True when the chosen service has what it needs to send. */
export async function isMailConfigured(): Promise<boolean> {
  return (await getEmailProvider()) === "ses" ? (await getSesCredentials()) !== null : (await resolveConfig()) !== null;
}

/** Send an email with the chosen service. Throws SMTP_NOT_CONFIGURED when it isn't set up. */
export async function sendMail(input: MailInput): Promise<void> {
  await sendMailWith(await getEmailProvider(), input);
}

/** Send with a specific service, whichever is chosen (the test emails in Settings). */
export async function sendMailWith(provider: EmailProvider, input: MailInput): Promise<void> {
  if (provider === "ses") {
    const c = await getSesCredentials();
    if (!c) throw new Error(SMTP_NOT_CONFIGURED);
    await nodemailer.createTransport(sesTransportOptions(c)).sendMail({
      from: c.fromName ? { name: c.fromName, address: c.fromEmail } : c.fromEmail,
      replyTo: c.replyTo || undefined,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      headers: input.headers,
    });
    return;
  }

  const c = await resolveConfig();
  if (!c) throw new Error(SMTP_NOT_CONFIGURED);

  const transport = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: c.user && c.pass ? { user: c.user, pass: c.pass } : undefined,
  });

  await transport.sendMail({
    from: c.fromName ? { name: c.fromName, address: c.fromEmail } : c.fromEmail,
    replyTo: c.replyTo || undefined,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    headers: input.headers,
  });
}
