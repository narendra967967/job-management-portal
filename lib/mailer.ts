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

async function loadConfig() {
  const [c] = await db
    .select()
    .from(smtpConfig)
    .where(eq(smtpConfig.id, "app"))
    .limit(1);
  if (!c || !c.enabled || !c.host || !c.fromEmail) return null;
  return c;
}

/** True when SMTP is set up and enabled. */
export async function isMailConfigured(): Promise<boolean> {
  return (await loadConfig()) !== null;
}

/** Send an email. Throws SMTP_NOT_CONFIGURED when SMTP isn't set up. */
export async function sendMail(input: MailInput): Promise<void> {
  const c = await loadConfig();
  if (!c) throw new Error(SMTP_NOT_CONFIGURED);

  const transport = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth:
      c.username && c.passwordCiphertext
        ? { user: c.username, pass: decryptSecret(c.passwordCiphertext) }
        : undefined,
  });

  await transport.sendMail({
    from: c.fromName ? `${c.fromName} <${c.fromEmail}>` : c.fromEmail,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
}
