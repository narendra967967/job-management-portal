"use server";

// Admin → Settings → Email delivery: save the Amazon SES details and choose
// which service sends the app's email. Every action checks for an admin and
// validates on the server; the screen's checks are only a convenience.

import { eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/current-user";
import { emailDelivery } from "@/db/schema";
import { encryptSecret } from "@/lib/crypto";
import { getEmailDelivery, getSesCredentials, providersReady } from "@/lib/email-delivery";
import { getSesAccount, sesErrorMessage } from "@/lib/ses";
import { sendAppEmail } from "@/lib/email";
import { getAppName } from "@/lib/branding";
import { PROVIDER_LABELS, emailError, sesInputSchema, type SesAccountInfo } from "@/lib/email-delivery-model";

type Result = { ok: true } | { ok: false; error: string };

const revalidate = () => revalidatePath("/jmp-admin/settings");

export async function saveSesAction(input: unknown): Promise<Result> {
  const adminId = await requireAdmin();
  const p = sesInputSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the details." };
  const v = p.data;
  const current = await getEmailDelivery();

  // A secret belongs to its key ID: a new key ID needs its own secret.
  if (!v.secretAccessKey && (!current.ses.hasSecret || v.accessKeyId !== current.ses.accessKeyId)) {
    return { ok: false, error: current.ses.hasSecret ? "A new access key ID needs its secret access key too." : "Add the secret access key." };
  }
  const credentialsChanged =
    v.region !== current.ses.region || v.accessKeyId !== current.ses.accessKeyId || !!v.secretAccessKey;

  const data = {
    sesRegion: v.region,
    sesAccessKeyId: v.accessKeyId,
    sesFromName: v.fromName,
    sesFromEmail: v.fromEmail,
    sesReplyTo: v.replyTo,
    updatedBy: adminId,
    // Only overwrite the stored secret when a new one was typed.
    ...(v.secretAccessKey ? { sesSecretCiphertext: encryptSecret(v.secretAccessKey) } : {}),
    // An old test result says nothing about new credentials.
    ...(credentialsChanged ? { sesLastTestOk: null, sesLastTestAt: null, sesAccount: null } : {}),
  };
  await db.insert(emailDelivery).values({ id: "app", ...data }).onConflictDoUpdate({ target: emailDelivery.id, set: data });
  revalidate();
  return { ok: true };
}

export async function setEmailProviderAction(provider: unknown): Promise<Result> {
  const adminId = await requireAdmin();
  const p = z.enum(["smtp", "ses"]).safeParse(provider);
  if (!p.success) return { ok: false, error: "Choose SMTP or Amazon SES." };
  const ready = await providersReady();
  if (!ready[p.data]) {
    return {
      ok: false,
      error:
        p.data === "ses"
          ? "Save the Amazon SES details first."
          : "Turn on SMTP and save its server and from email first.",
    };
  }
  const data = { provider: p.data, updatedBy: adminId };
  await db.insert(emailDelivery).values({ id: "app", ...data }).onConflictDoUpdate({ target: emailDelivery.id, set: data });
  console.info(`[email-delivery] email now sent with ${PROVIDER_LABELS[p.data]}`);
  revalidate();
  return { ok: true };
}

/** Reads the SES account with the saved details and keeps the result for the screen. */
export async function testSesAction(): Promise<{ ok: true; account: SesAccountInfo } | { ok: false; error: string }> {
  const adminId = await requireAdmin();
  const creds = await getSesCredentials();
  if (!creds) return { ok: false, error: "Save the Amazon SES details first." };
  const now = new Date();
  try {
    const account = await getSesAccount(creds);
    await db
      .update(emailDelivery)
      .set({ sesLastTestOk: true, sesLastTestAt: now, sesAccount: account, updatedBy: adminId })
      .where(eq(emailDelivery.id, "app"));
    revalidate();
    return { ok: true, account };
  } catch (e) {
    await db
      .update(emailDelivery)
      .set({ sesLastTestOk: false, sesLastTestAt: now, sesAccount: null, updatedBy: adminId })
      .where(eq(emailDelivery.id, "app"));
    revalidate();
    return { ok: false, error: sesErrorMessage(e, creds.region) };
  }
}

/** Sends a short email through Amazon SES, even while SMTP is the service in use. */
export async function sendSesTestAction(to: unknown): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  await requireAdmin();
  const p = z.string().trim().max(254).refine((v) => v && !emailError(v), "Enter the address to send the test to.").safeParse(to);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Enter an email address." };
  if (!(await getSesCredentials())) return { ok: false, error: "Save the Amazon SES details first." };
  const appName = await getAppName();
  try {
    await sendAppEmail({
      via: "ses",
      to: p.data,
      subject: `${appName}: Amazon SES test email`,
      heading: "Amazon SES is working",
      lines: [
        "This test came from Settings → Email delivery, sent through Amazon SES.",
        "If it reached your inbox (and not spam), SES is ready to send your app's email.",
      ],
    });
    return { ok: true, to: p.data };
  } catch (e) {
    const region = (await getEmailDelivery()).ses.region;
    return { ok: false, error: sesErrorMessage(e, region) };
  }
}
