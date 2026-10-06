import "server-only";

// Read side of the admin Settings page — loads every config row (+ the admin's
// profile). Mutations live in actions/admin-settings.ts. Secrets are returned only
// as a "configured" flag / last4, never decrypted.

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  appSettings,
  securityConfig,
  cronConfig,
  billingConfig,
  appAiConfig,
  smtpConfig,
  user,
} from "@/db/schema";
import { getBranding } from "@/lib/branding";

export interface AdminSettings {
  profile: { name: string; email: string; mobile: string };
  general: { appName: string; supportEmail: string; allowSignup: boolean; maintenance: boolean };
  branding: { hasLogo: boolean; logoVersion: number; hasFavicon: boolean; faviconVersion: number };
  security: {
    pwMinLength: number;
    pwRequireUpper: boolean;
    pwRequireLower: boolean;
    pwRequireNumber: boolean;
    pwRequireSpecial: boolean;
    sessionValue: number;
    sessionUnit: string;
  };
  cron: {
    quietEnabled: boolean;
    quietFrom: string;
    quietTo: string;
    quietTz: string;
    quietDays: string[];
    purgeEnabled: boolean;
    purgeDays: number;
    purgeStatuses: string[];
  };
  billing: {
    enabled: boolean;
    provider: string;
    mode: string;
    currency: string;
    keyId: string;
    hasSecret: boolean;
    gstin: string;
    taxRate: number;
    pricesIncludeTax: boolean;
    companyName: string;
    companyAddress: string;
    invoicePrefix: string;
  };
  ai: {
    adminProvider: string;
    adminModel: string;
    hasKey: boolean;
    keyLast4: string;
    defaultPromptSummary: string;
    defaultPromptDraft: string;
    defaultPromptScore: string;
  };
  smtp: {
    enabled: boolean;
    host: string;
    port: number;
    encryption: string;
    username: string;
    hasPassword: boolean;
    fromEmail: string;
    fromName: string;
    replyTo: string;
  };
}

export async function loadAdminSettings(adminId: string): Promise<AdminSettings> {
  const [u, gen, sec, cron, bill, ai, smtp, branding] = await Promise.all([
    db.select({ name: user.name, email: user.email, mobile: user.mobile }).from(user).where(eq(user.id, adminId)).limit(1),
    db.select().from(appSettings).limit(1),
    db.select().from(securityConfig).limit(1),
    db.select().from(cronConfig).limit(1),
    db.select().from(billingConfig).limit(1),
    db.select().from(appAiConfig).limit(1),
    db.select().from(smtpConfig).limit(1),
    getBranding(),
  ]);
  const g = gen[0];
  const s = sec[0];
  const c = cron[0];
  const b = bill[0];
  const a = ai[0];
  const m = smtp[0];

  return {
    profile: { name: u[0]?.name ?? "", email: u[0]?.email ?? "", mobile: u[0]?.mobile ?? "" },
    branding,
    general: {
      appName: g?.appName ?? "Job Management Portal",
      supportEmail: g?.supportEmail ?? "",
      allowSignup: g?.allowSignup ?? false,
      maintenance: g?.maintenance ?? false,
    },
    security: {
      pwMinLength: s?.pwMinLength ?? 8,
      pwRequireUpper: s?.pwRequireUpper ?? true,
      pwRequireLower: s?.pwRequireLower ?? true,
      pwRequireNumber: s?.pwRequireNumber ?? true,
      pwRequireSpecial: s?.pwRequireSpecial ?? true,
      sessionValue: s?.sessionValue ?? 7,
      sessionUnit: s?.sessionUnit ?? "days",
    },
    cron: {
      quietEnabled: c?.quietEnabled ?? false,
      quietFrom: c?.quietFrom ?? "22:00",
      quietTo: c?.quietTo ?? "07:00",
      quietTz: c?.quietTz ?? "Asia/Kolkata",
      quietDays: c?.quietDays ?? [],
      purgeEnabled: c?.purgeEnabled ?? false,
      purgeDays: c?.purgeDays ?? 90,
      purgeStatuses: c?.purgeStatuses ?? [],
    },
    billing: {
      enabled: b?.enabled ?? false,
      provider: b?.provider ?? "razorpay",
      mode: b?.mode ?? "test",
      currency: b?.currency ?? "INR",
      keyId: b?.keyId ?? "",
      hasSecret: !!b?.keySecretCiphertext,
      gstin: b?.gstin ?? "",
      taxRate: b?.taxRate ?? 18,
      pricesIncludeTax: b?.pricesIncludeTax ?? false,
      companyName: b?.companyName ?? "",
      companyAddress: b?.companyAddress ?? "",
      invoicePrefix: b?.invoicePrefix ?? "JMP-",
    },
    ai: {
      adminProvider: a?.adminProvider ?? "openai",
      adminModel: a?.adminModel ?? "",
      hasKey: !!a?.adminKeyCiphertext,
      keyLast4: a?.adminKeyLast4 ?? "",
      defaultPromptSummary: a?.defaultPromptSummary ?? "",
      defaultPromptDraft: a?.defaultPromptDraft ?? "",
      defaultPromptScore: a?.defaultPromptScore ?? "",
    },
    smtp: {
      enabled: m?.enabled ?? false,
      host: m?.host ?? "",
      port: m?.port ?? 587,
      encryption: m?.encryption ?? "starttls",
      username: m?.username ?? "",
      hasPassword: !!m?.passwordCiphertext,
      fromEmail: m?.fromEmail ?? "",
      fromName: m?.fromName ?? "",
      replyTo: m?.replyTo ?? "",
    },
  };
}
