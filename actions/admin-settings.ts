"use server";

// Admin Settings Server Actions — persist each Settings section. Admin-guarded,
// Zod-validated. Secrets (SMTP password, billing key, admin AI key) are encrypted
// at rest (lib/crypto); only a "configured" flag / last4 is read back.

import { eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/current-user";
import { authAdmin } from "@/lib/auth-admin";
import { encryptSecret } from "@/lib/crypto";
import { validatePassword } from "@/lib/admin/password-policy-server";
import { getAppName } from "@/lib/branding";
import { sendAppEmail, SMTP_NOT_CONFIGURED } from "@/lib/email";
import {
  appAssets,
  appSettings,
  securityConfig,
  cronConfig,
  billingConfig,
  appAiConfig,
  smtpConfig,
  user,
} from "@/db/schema";

type Result = { ok: true } | { ok: false; error: string };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(e: z.ZodError): Result {
  return { ok: false, error: e.issues[0]?.message ?? "Invalid input." };
}
function revalidate() {
  revalidatePath("/jmp-admin/settings");
}

/* ---------------- Profile ---------------- */

export async function updateAdminProfileAction(input: unknown): Promise<Result> {
  const adminId = await requireAdmin();
  const p = z
    .object({
      name: z.string().trim().min(1, "Name is required.").max(120),
      mobile: z.string().trim().max(24, "Contact number is too long.").optional().default(""),
    })
    .safeParse(input);
  if (!p.success) return fail(p.error);
  await db.update(user).set({ name: p.data.name, mobile: p.data.mobile || null }).where(eq(user.id, adminId));
  revalidate();
  return { ok: true };
}

/* ---------------- Password (admin's own) ---------------- */

export async function updateAdminPasswordAction(input: unknown): Promise<Result> {
  await requireAdmin();
  const p = z
    .object({
      currentPassword: z.string().min(1, "Enter your current password."),
      newPassword: z.string().min(1, "Enter a new password."),
    })
    .safeParse(input);
  if (!p.success) return fail(p.error);

  // Enforce the configured policy here (Better Auth only checks min length).
  const pwError = await validatePassword(p.data.newPassword);
  if (pwError) return { ok: false, error: pwError };

  try {
    await authAdmin.api.changePassword({
      body: {
        currentPassword: p.data.currentPassword,
        newPassword: p.data.newPassword,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
    return { ok: true };
  } catch {
    // Wrong current password (or any auth failure) — stay generic.
    return { ok: false, error: "Current password is incorrect." };
  }
}

/* ---------------- General ---------------- */

export async function updateGeneralAction(input: unknown): Promise<Result> {
  await requireAdmin();
  const p = z
    .object({
      appName: z.string().trim().min(1, "App name is required.").max(120),
      supportEmail: z.string().trim().refine((v) => v === "" || EMAIL_RE.test(v), "Enter a valid support email."),
      allowSignup: z.boolean(),
      maintenance: z.boolean(),
    })
    .safeParse(input);
  if (!p.success) return fail(p.error);
  const v = p.data;
  const data = {
    appName: v.appName,
    supportEmail: v.supportEmail || null,
    allowSignup: v.allowSignup,
    maintenance: v.maintenance,
  };
  await db.insert(appSettings).values({ id: "app", ...data }).onConflictDoUpdate({ target: appSettings.id, set: data });
  revalidate();
  // App name drives the site-wide <title>, so refresh the whole app layout too.
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------------- Branding (logo + favicon) ---------------- */

const BRANDING_MAX_BYTES = 512 * 1024; // 512 KB — plenty for a logo/favicon
// Extension → served Content-Type. SVG is intentionally excluded (script-in-SVG
// XSS vector when served from our own origin).
const LOGO_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};
const FAVICON_TYPES: Record<string, string> = {
  png: "image/png",
  ico: "image/x-icon",
};

export async function uploadBrandingAction(formData: FormData): Promise<Result> {
  await requireAdmin();
  const kind = String(formData.get("kind") ?? "");
  if (kind !== "logo" && kind !== "favicon") return { ok: false, error: "Invalid asset." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file to upload." };
  if (file.size > BRANDING_MAX_BYTES) return { ok: false, error: "File must be under 512 KB." };

  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const allowed = kind === "logo" ? LOGO_TYPES : FAVICON_TYPES;
  const contentType = allowed[ext];
  if (!contentType) {
    return {
      ok: false,
      error: kind === "logo" ? "Upload a PNG, JPG, or WebP image." : "Upload a PNG or ICO file.",
    };
  }

  const data = Buffer.from(await file.arrayBuffer());
  const row = { contentType, data, updatedAt: new Date() };
  await db.insert(appAssets).values({ kind, ...row }).onConflictDoUpdate({ target: appAssets.kind, set: row });
  revalidatePath("/", "layout");
  revalidate();
  return { ok: true };
}

export async function removeBrandingAction(kind: unknown): Promise<Result> {
  await requireAdmin();
  const k = z.enum(["logo", "favicon"]).safeParse(kind);
  if (!k.success) return { ok: false, error: "Invalid asset." };
  await db.delete(appAssets).where(eq(appAssets.kind, k.data));
  revalidatePath("/", "layout");
  revalidate();
  return { ok: true };
}

/* ---------------- Security ---------------- */

export async function updateSecurityAction(input: unknown): Promise<Result> {
  await requireAdmin();
  const p = z
    .object({
      pwMinLength: z.number().int().min(6, "Minimum length must be at least 6.").max(128),
      pwRequireUpper: z.boolean(),
      pwRequireLower: z.boolean(),
      pwRequireNumber: z.boolean(),
      pwRequireSpecial: z.boolean(),
      sessionValue: z.number().int().min(1).max(3650),
      sessionUnit: z.enum(["hours", "days"]),
    })
    .safeParse(input);
  if (!p.success) return fail(p.error);
  const v = p.data;
  await db.insert(securityConfig).values({ id: "app", ...v }).onConflictDoUpdate({ target: securityConfig.id, set: v });
  // The client PasswordField policy store is synced in the Security card (client).
  revalidate();
  return { ok: true };
}

/* ---------------- Cron & schedule ---------------- */

export async function updateCronAction(input: unknown): Promise<Result> {
  await requireAdmin();
  const p = z
    .object({
      syncIntervalHours: z.number().int().min(1).max(24),
      quietEnabled: z.boolean(),
      quietFrom: z.string().regex(/^\d{2}:\d{2}$/),
      quietTo: z.string().regex(/^\d{2}:\d{2}$/),
      quietTz: z.string().min(1),
      quietDays: z.array(z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])).max(7),
      purgeEnabled: z.boolean(),
      purgeDays: z.number().int().min(1).max(3650),
      purgeStatuses: z
        .array(z.enum(["new", "reviewing", "applied", "discarded", "closed"]))
        .max(10),
    })
    .safeParse(input);
  if (!p.success) return fail(p.error);
  const v = p.data;
  await db.insert(cronConfig).values({ id: "app", ...v }).onConflictDoUpdate({ target: cronConfig.id, set: v });
  revalidate();
  return { ok: true };
}

/* ---------------- Billing ---------------- */

export async function updateBillingAction(input: unknown): Promise<Result> {
  await requireAdmin();
  const p = z
    .object({
      enabled: z.boolean(),
      provider: z.enum(["razorpay", "stripe"]),
      mode: z.enum(["test", "live"]),
      currency: z.enum(["INR", "USD"]),
      keyId: z.string().optional().default(""),
      keySecret: z.string().optional().default(""),
      gstin: z.string().optional().default(""),
      taxRate: z.number().int().min(0, "Tax rate 0–100.").max(100, "Tax rate 0–100."),
      pricesIncludeTax: z.boolean(),
      companyName: z.string().optional().default(""),
      companyAddress: z.string().optional().default(""),
      invoicePrefix: z.string().optional().default(""),
    })
    .safeParse(input);
  if (!p.success) return fail(p.error);
  const v = p.data;
  if (v.enabled && !v.keyId.trim()) return { ok: false, error: "Enter the gateway key ID." };
  if (v.gstin.trim() && v.gstin.trim().length !== 15) return { ok: false, error: "A GSTIN is 15 characters." };
  const data: Record<string, unknown> = {
    enabled: v.enabled,
    provider: v.provider,
    mode: v.mode,
    currency: v.currency,
    keyId: v.keyId || null,
    gstin: v.gstin || null,
    taxRate: v.taxRate,
    pricesIncludeTax: v.pricesIncludeTax,
    companyName: v.companyName || null,
    companyAddress: v.companyAddress || null,
    invoicePrefix: v.invoicePrefix || "JMP-",
  };
  if (v.keySecret) data.keySecretCiphertext = encryptSecret(v.keySecret);
  await db.insert(billingConfig).values({ id: "app", ...data }).onConflictDoUpdate({ target: billingConfig.id, set: data });
  revalidate();
  return { ok: true };
}

/* ---------------- AI ---------------- */

export async function updateAiAction(input: unknown): Promise<Result> {
  await requireAdmin();
  const p = z
    .object({
      adminProvider: z.enum(["openai", "anthropic", "openrouter"]),
      adminModel: z.string().optional().default(""),
      adminKey: z.string().optional().default(""),
      defaultPromptSummary: z.string().max(8000).optional().default(""),
      defaultPromptDraft: z.string().max(8000).optional().default(""),
      defaultPromptScore: z.string().max(8000).optional().default(""),
    })
    .safeParse(input);
  if (!p.success) return fail(p.error);
  const v = p.data;
  if (v.adminKey && v.adminKey.trim().length < 8) return { ok: false, error: "Enter a valid API key." };
  const data: Record<string, unknown> = {
    adminProvider: v.adminProvider,
    adminModel: v.adminModel || null,
    defaultPromptSummary: v.defaultPromptSummary || null,
    defaultPromptDraft: v.defaultPromptDraft || null,
    defaultPromptScore: v.defaultPromptScore || null,
  };
  if (v.adminKey) {
    data.adminKeyCiphertext = encryptSecret(v.adminKey.trim());
    data.adminKeyLast4 = v.adminKey.trim().slice(-4);
  }
  await db.insert(appAiConfig).values({ id: "app", ...data }).onConflictDoUpdate({ target: appAiConfig.id, set: data });
  revalidate();
  return { ok: true };
}

/* ---------------- Email / SMTP ---------------- */

const emailSchema = z.object({
  enabled: z.boolean(),
  host: z.string().optional().default(""),
  port: z.number().int().min(1).max(65535),
  encryption: z.enum(["none", "starttls", "ssl", "tls"]),
  username: z.string().optional().default(""),
  password: z.string().optional().default(""),
  fromName: z.string().optional().default(""),
  fromEmail: z.string().optional().default(""),
  replyTo: z.string().optional().default(""),
});

export async function updateEmailAction(input: unknown): Promise<Result> {
  await requireAdmin();
  const p = emailSchema.safeParse(input);
  if (!p.success) return fail(p.error);
  const v = p.data;
  if (v.enabled) {
    if (!v.host.trim()) return { ok: false, error: "SMTP host is required." };
    if (!EMAIL_RE.test(v.fromEmail.trim())) return { ok: false, error: "Enter a valid “From” email." };
  }
  if (v.replyTo.trim() && !EMAIL_RE.test(v.replyTo.trim())) return { ok: false, error: "Enter a valid reply-to email." };
  const data = {
    enabled: v.enabled,
    host: v.host || "",
    port: v.port,
    encryption: v.encryption,
    secure: v.encryption === "ssl" || v.encryption === "tls",
    username: v.username || null,
    fromEmail: v.fromEmail || "",
    fromName: v.fromName || null,
    replyTo: v.replyTo || null,
    // Only overwrite the stored password when a new one was typed.
    ...(v.password ? { passwordCiphertext: encryptSecret(v.password) } : {}),
  };
  await db.insert(smtpConfig).values({ id: "app", ...data }).onConflictDoUpdate({ target: smtpConfig.id, set: data });
  revalidate();
  return { ok: true };
}

export async function sendTestEmailAction(to: unknown): Promise<Result> {
  await requireAdmin();
  const p = z.string().trim().refine((v) => EMAIL_RE.test(v), "Enter a valid email address.").safeParse(to);
  if (!p.success) return fail(p.error);
  const appName = await getAppName();
  try {
    await sendAppEmail({
      to: p.data,
      subject: `${appName} — SMTP test email`,
      heading: "Your SMTP is working",
      lines: [
        "This is a test email from your admin settings.",
        "If it landed in your inbox, outbound email is configured correctly.",
      ],
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === SMTP_NOT_CONFIGURED) return { ok: false, error: "Save your SMTP settings first." };
    return { ok: false, error: "Couldn't send — check the SMTP settings." };
  }
}
