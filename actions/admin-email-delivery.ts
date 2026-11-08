"use server";

// Admin → Settings → Email delivery: save the Amazon SES details and choose
// which service sends the app's email. Every action checks for an admin and
// validates on the server; the screen's checks are only a convenience.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/current-user";
import { emailDelivery } from "@/db/schema";
import { encryptSecret } from "@/lib/crypto";
import { getEmailDelivery, providersReady } from "@/lib/email-delivery";
import {
  PROVIDER_LABELS,
  accessKeyIdError,
  emailError,
  regionError,
  secretKeyError,
  type SesAccountInfo,
} from "@/lib/email-delivery-model";

type Result = { ok: true } | { ok: false; error: string };

const revalidate = () => revalidatePath("/jmp-admin/settings");

/** Turns a model check ("" = fine) into a Zod refinement. */
const checked = (fn: (v: string) => string, max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .superRefine((v, ctx) => {
      const msg = fn(v);
      if (msg) ctx.addIssue({ code: "custom", message: msg });
    });

const sesSchema = z.object({
  region: checked(regionError, 30).refine(Boolean, "Enter the region."),
  accessKeyId: checked(accessKeyIdError, 128).refine(Boolean, "Enter the access key ID."),
  secretAccessKey: checked(secretKeyError, 128),
  fromName: z.string().trim().max(100, "Keep the from name under 100 characters."),
  fromEmail: checked(emailError, 254).refine(Boolean, "Enter the from email."),
  replyTo: checked(emailError, 254),
});

export async function saveSesAction(input: unknown): Promise<Result> {
  const adminId = await requireAdmin();
  const p = sesSchema.safeParse(input);
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

/** PHASE 2: connecting to SES comes in phase 3 with the AWS SDK. */
const NOT_YET = "Connecting to Amazon SES comes in the next update. Your details are saved.";

export async function testSesAction(): Promise<{ ok: true; account: SesAccountInfo } | { ok: false; error: string }> {
  await requireAdmin();
  const current = await getEmailDelivery();
  if (!current.ses.hasSecret) return { ok: false, error: "Save the Amazon SES details first." };
  return { ok: false, error: NOT_YET };
}

export async function sendSesTestAction(to: unknown): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  await requireAdmin();
  const p = z.string().trim().max(254).refine((v) => v && !emailError(v), "Enter the address to send the test to.").safeParse(to);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Enter an email address." };
  return { ok: false, error: NOT_YET };
}
