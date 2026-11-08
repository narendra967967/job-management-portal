"use server";

// Admin → Email templates. Every action checks for an admin session and
// validates its input on the server; the editor's checks are only a convenience.
// Saving or resetting keeps the wording it replaces as a version (newest 5).

import { and, desc, eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/current-user";
import { emailTemplates, emailTemplateVersions, user } from "@/db/schema";
import { sanitizeGuideHtml } from "@/lib/guide-html";
import { isMailConfigured } from "@/lib/email";
import { siteUrl } from "@/lib/site-url";
import { sendTemplateEmail } from "@/lib/email-templates";
import {
  EMAIL_TEMPLATES,
  TEMPLATE_VERSIONS_KEPT,
  emailTemplateContentSchema,
  sameContent,
  sampleValues,
  templateByKey,
  templateProblems,
  type EmailTemplateContent,
  type EmailTemplateDef,
  type TemplateProblem,
} from "@/lib/email-templates-model";

type SaveResult = { ok: true; content: EmailTemplateContent } | { ok: false; error: string; problems?: TemplateProblem[] };

const zKey = z.string().max(60);
const NOT_FOUND = "That email doesn't exist.";

const revalidate = () => revalidatePath("/jmp-admin/email-templates", "layout");

/**
 * Checks and cleans wording from the editor. The button stays exactly as the
 * email defines it: a label when it has a button, none when it doesn't.
 */
function prepare(def: EmailTemplateDef, input: unknown): { content: EmailTemplateContent } | { error: string; problems?: TemplateProblem[] } {
  const p = emailTemplateContentSchema.safeParse(input);
  if (!p.success) return { error: "Something in the wording is too long." };
  const raw: EmailTemplateContent = {
    ...p.data,
    buttonLabel: def.defaults.buttonLabel === null ? null : (p.data.buttonLabel ?? ""),
  };
  // The built-in wording is trusted; anything else is cleaned like guide HTML.
  const content = sameContent(raw, def.defaults) ? def.defaults : { ...raw, bodyHtml: sanitizeGuideHtml(raw.bodyHtml) };
  const problems = templateProblems(def, content);
  if (problems.length) return { error: problems[0].message, problems };
  return { content };
}

/**
 * Replaces an email's wording (null = back to the built-in wording) and keeps
 * what it replaced as a version. Returns false when nothing changed.
 */
async function replaceWording(def: EmailTemplateDef, next: EmailTemplateContent | null, adminId: string): Promise<boolean> {
  // Wording equal to the default is stored as "default", so later changes to
  // the built-in wording reach it.
  const stored = next && !sameContent(next, def.defaults) ? next : null;
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(emailTemplates).where(eq(emailTemplates.key, def.key)).for("update");
    const before = current?.content ?? null;
    if (sameContent(before ?? def.defaults, stored ?? def.defaults)) return false;

    const now = new Date();
    await tx.insert(emailTemplateVersions).values({
      templateKey: def.key,
      content: before ?? def.defaults,
      isDefault: before === null,
      savedBy: current?.updatedBy ?? null,
      savedAt: current?.updatedAt ?? now,
    });
    await tx
      .insert(emailTemplates)
      .values({ key: def.key, content: stored, updatedBy: adminId, updatedAt: now })
      .onConflictDoUpdate({ target: emailTemplates.key, set: { content: stored, updatedBy: adminId, updatedAt: now } });

    // Keep the newest few.
    const keep = await tx
      .select({ id: emailTemplateVersions.id })
      .from(emailTemplateVersions)
      .where(eq(emailTemplateVersions.templateKey, def.key))
      .orderBy(desc(emailTemplateVersions.createdAt))
      .limit(TEMPLATE_VERSIONS_KEPT);
    await tx.delete(emailTemplateVersions).where(
      and(
        eq(emailTemplateVersions.templateKey, def.key),
        notInArray(
          emailTemplateVersions.id,
          keep.map((k) => k.id),
        ),
      ),
    );
    return true;
  });
}

export async function saveEmailTemplateAction(key: string, input: EmailTemplateContent): Promise<SaveResult> {
  const adminId = await requireAdmin();
  const def = zKey.safeParse(key).success ? templateByKey(key) : undefined;
  if (!def) return { ok: false, error: NOT_FOUND };
  const prepared = prepare(def, input);
  if ("error" in prepared) return { ok: false, error: prepared.error, problems: prepared.problems };
  await replaceWording(def, prepared.content, adminId);
  revalidate();
  return { ok: true, content: prepared.content };
}

/** Puts an earlier version back; the current wording becomes a version itself. */
export async function restoreEmailTemplateVersionAction(key: string, versionId: string): Promise<SaveResult> {
  const adminId = await requireAdmin();
  const def = zKey.safeParse(key).success ? templateByKey(key) : undefined;
  if (!def || !z.string().uuid().safeParse(versionId).success) return { ok: false, error: NOT_FOUND };
  const [v] = await db
    .select({ content: emailTemplateVersions.content })
    .from(emailTemplateVersions)
    .where(and(eq(emailTemplateVersions.id, versionId), eq(emailTemplateVersions.templateKey, key)));
  if (!v) return { ok: false, error: "That version is gone. Only the newest 5 are kept." };
  // A version saved before the email's placeholders changed may not fit any more.
  const prepared = prepare(def, v.content);
  if ("error" in prepared) return { ok: false, error: `That version can't be used now: ${prepared.error}` };
  await replaceWording(def, prepared.content, adminId);
  revalidate();
  return { ok: true, content: prepared.content };
}

/** Back to the built-in wording, for one email or several. */
export async function resetEmailTemplatesAction(keys: string[]): Promise<{ ok: true; reset: number } | { ok: false; error: string }> {
  const adminId = await requireAdmin();
  const p = z.array(zKey).min(1).max(EMAIL_TEMPLATES.length).safeParse(keys);
  if (!p.success) return { ok: false, error: "Choose at least one email." };
  const defs = [...new Set(p.data)].map(templateByKey);
  if (defs.some((d) => !d)) return { ok: false, error: NOT_FOUND };
  let reset = 0;
  for (const def of defs as EmailTemplateDef[]) if (await replaceWording(def, null, adminId)) reset++;
  revalidate();
  return { ok: true, reset };
}

/**
 * Sends the email to the signed-in admin with sample values filled in. Pass
 * `input` to test wording that isn't saved yet; without it, the saved wording.
 */
export async function sendEmailTemplateTestAction(
  key: string,
  input?: EmailTemplateContent,
): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  const adminId = await requireAdmin();
  const def = zKey.safeParse(key).success ? templateByKey(key) : undefined;
  if (!def) return { ok: false, error: NOT_FOUND };
  let content: EmailTemplateContent | undefined;
  if (input !== undefined) {
    const prepared = prepare(def, input);
    if ("error" in prepared) return { ok: false, error: prepared.error };
    content = prepared.content;
  }
  if (!(await isMailConfigured())) return { ok: false, error: "Email isn't set up yet. Set it up in Settings → Email delivery first." };
  const [me] = await db.select({ email: user.email }).from(user).where(eq(user.id, adminId));
  if (!me?.email) return { ok: false, error: "Your admin account has no email address." };

  const { app_name: _sampleName, ...samples } = sampleValues(def);
  void _sampleName;
  try {
    await sendTemplateEmail(def.key, { to: me.email, values: samples, content, buttonUrl: siteUrl(), subjectPrefix: "[Test] " });
  } catch (e) {
    console.error("email template test failed", e);
    return { ok: false, error: "The test email didn't send. Check Settings → Email delivery." };
  }
  return { ok: true, to: me.email };
}
