import "server-only";

// Email delivery on the server: which service sends the app's email, and the
// Amazon SES details. The admin screen gets them without the secret; only the
// mailer (lib/mailer.ts) reads the decrypted credentials. Spec: memory amazon-ses.

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailDelivery, smtpConfig } from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";
import { sesMissing, smtpReady, type EmailProvider, type SesSettings } from "@/lib/email-delivery-model";

export interface EmailDeliveryState {
  provider: EmailProvider;
  ses: SesSettings;
}

async function row() {
  const [r] = await db.select().from(emailDelivery).where(eq(emailDelivery.id, "app"));
  return r ?? null;
}

/** For the admin screen: everything except the secret. A missing row means SMTP and no SES details. */
export async function getEmailDelivery(): Promise<EmailDeliveryState> {
  const r = await row();
  return {
    provider: r?.provider ?? "smtp",
    ses: {
      region: r?.sesRegion ?? "",
      accessKeyId: r?.sesAccessKeyId ?? "",
      hasSecret: !!r?.sesSecretCiphertext,
      fromName: r?.sesFromName ?? "",
      fromEmail: r?.sesFromEmail ?? "",
      replyTo: r?.sesReplyTo ?? "",
      lastTestAt: r?.sesLastTestAt?.toISOString() ?? null,
      lastTestOk: r?.sesLastTestOk ?? null,
      account: r?.sesAccount ?? null,
    },
  };
}

/** The service that sends right now. */
export async function getEmailProvider(): Promise<EmailProvider> {
  return (await row())?.provider ?? "smtp";
}

export interface SesCredentials {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
}

/** Decrypted SES details for sending, or null while they're incomplete. Server only. */
export async function getSesCredentials(): Promise<SesCredentials | null> {
  const r = await row();
  if (!r || !r.sesSecretCiphertext) return null;
  if (sesMissing({ region: r.sesRegion, accessKeyId: r.sesAccessKeyId, hasSecret: true, fromEmail: r.sesFromEmail }).length) {
    return null;
  }
  return {
    region: r.sesRegion,
    accessKeyId: r.sesAccessKeyId,
    secretAccessKey: decryptSecret(r.sesSecretCiphertext),
    fromName: r.sesFromName,
    fromEmail: r.sesFromEmail,
    replyTo: r.sesReplyTo,
  };
}

/** Whether each service has what it needs to send (the switch refuses one that doesn't). */
export async function providersReady(): Promise<Record<EmailProvider, boolean>> {
  const [r, [smtp]] = await Promise.all([row(), db.select().from(smtpConfig).where(eq(smtpConfig.id, "app"))]);
  return {
    smtp: !!smtp && smtpReady({ enabled: smtp.enabled, host: smtp.host, fromEmail: smtp.fromEmail }),
    ses: !!r && sesMissing({ region: r.sesRegion, accessKeyId: r.sesAccessKeyId, hasSecret: !!r.sesSecretCiphertext, fromEmail: r.sesFromEmail }).length === 0,
  };
}
