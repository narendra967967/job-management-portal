import "server-only";

// Email templates on the server: reading what admins saved, and turning a
// template plus its values into the parts sendAppEmail takes. The registry and
// the checks are in lib/email-templates-model.ts (shared with the editor).

import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailTemplates, emailTemplateVersions, user } from "@/db/schema";
import { getAppName } from "@/lib/branding";
import { sanitizeGuideHtml } from "@/lib/guide-html";
import {
  EMAIL_TEMPLATES,
  TEMPLATE_VERSIONS_KEPT,
  emailTemplateContentSchema,
  fillTemplate,
  sameContent,
  templateByKey,
  templateProblems,
  type EmailTemplateContent,
  type EmailTemplateDef,
  type TemplateState,
  type TemplateVersion,
} from "@/lib/email-templates-model";

const iso = (d: Date) => d.toISOString();

/** Saved wording counts only if it differs from the built-in one. */
const isEdited = (def: EmailTemplateDef, content: EmailTemplateContent | null) =>
  !!content && !sameContent(content, def.defaults);

/** Every automatic email with its current wording, in registry order. */
export async function loadTemplateStates(): Promise<TemplateState[]> {
  const rows = await db
    .select({ t: emailTemplates, by: user.name })
    .from(emailTemplates)
    .leftJoin(user, eq(user.id, emailTemplates.updatedBy));
  const byKey = new Map(rows.map((r) => [r.t.key, r]));
  return EMAIL_TEMPLATES.map((def) => {
    const r = byKey.get(def.key);
    const content = r?.t.content ?? null;
    return {
      key: def.key,
      content: content ?? def.defaults,
      edited: isEdited(def, content),
      updatedAt: r ? iso(r.t.updatedAt) : null,
      updatedBy: r?.by ?? null,
    };
  });
}

/** One email's wording plus its earlier versions, newest first. */
export async function loadTemplate(key: string): Promise<{ state: TemplateState; versions: TemplateVersion[] } | null> {
  if (!templateByKey(key)) return null;
  const state = (await loadTemplateStates()).find((s) => s.key === key)!;
  const rows = await db
    .select({ v: emailTemplateVersions, by: user.name })
    .from(emailTemplateVersions)
    .leftJoin(user, eq(user.id, emailTemplateVersions.savedBy))
    .where(eq(emailTemplateVersions.templateKey, key))
    .orderBy(desc(emailTemplateVersions.createdAt))
    .limit(TEMPLATE_VERSIONS_KEPT);
  return {
    state,
    versions: rows.map(({ v, by }) => ({
      id: v.id,
      content: v.content,
      savedAt: iso(v.savedAt),
      savedBy: by ?? null,
      isDefault: v.isDefault,
    })),
  };
}

/**
 * The wording to send. Saved wording that no longer passes the checks (edited
 * straight in the database, or the email's placeholders changed in code) falls
 * back to the built-in wording, so the email still goes out.
 */
export async function getTemplateContent(def: EmailTemplateDef): Promise<EmailTemplateContent> {
  const [row] = await db.select({ content: emailTemplates.content }).from(emailTemplates).where(eq(emailTemplates.key, def.key));
  if (!row?.content) return def.defaults;
  const parsed = emailTemplateContentSchema.safeParse(row.content);
  if (!parsed.success || templateProblems(def, parsed.data).length > 0) {
    console.warn(`[email-templates] saved wording for "${def.key}" is unusable; sending the built-in wording`);
    return def.defaults;
  }
  return parsed.data;
}

/* ---------------- rendering ---------------- */

const FONT = "font-family:Arial,Helvetica,sans-serif;";
const TEXT = `${FONT}font-size:14px;line-height:1.6;color:#374151;`;
const STYLES: Record<string, string> = {
  p: `margin:0 0 14px;${TEXT}`,
  li: `margin:0 0 6px;${TEXT}`,
  ul: "margin:0 0 14px;padding-left:22px;",
  ol: "margin:0 0 14px;padding-left:22px;",
  h1: `margin:0 0 12px;${FONT}font-size:18px;font-weight:bold;color:#111827;`,
  h2: `margin:0 0 12px;${FONT}font-size:17px;font-weight:bold;color:#111827;`,
  h3: `margin:0 0 10px;${FONT}font-size:15px;font-weight:bold;color:#111827;`,
  h4: `margin:0 0 10px;${FONT}font-size:14px;font-weight:bold;color:#111827;`,
  a: "color:#4f46e5;",
  blockquote: `margin:0 0 14px;padding:8px 14px;border-left:3px solid #e5e7eb;${TEXT}`,
  td: `padding:6px 10px 6px 0;vertical-align:top;${TEXT}`,
  th: `padding:6px 10px 6px 0;text-align:left;${TEXT}font-weight:bold;`,
  img: "max-width:100%;height:auto;",
  hr: "border:0;border-top:1px solid #e5e7eb;margin:18px 0;",
};
const STYLED_TAG = new RegExp(`<(${Object.keys(STYLES).join("|")})(?=[\\s>/])`, "gi");

/**
 * Admin HTML made safe and given inline styles, because email apps ignore
 * stylesheets. Runs before the values go in: block values are the sender's own
 * HTML and are styled already.
 */
export function emailBodyHtml(html: string): string {
  // The sanitizer drops every style attribute and escapes "<" in text, so a tag
  // name right after "<" is always a real tag with no style of its own yet.
  return sanitizeGuideHtml(html).replace(STYLED_TAG, (_, tag: string) => `<${tag} style="${STYLES[tag.toLowerCase()]}"`);
}

export interface RenderedTemplate {
  subject: string;
  heading: string;
  bodyHtml: string;
  /** Null when the email has no button; the sender adds the link. */
  buttonLabel: string | null;
  footerNote: string;
}

/**
 * A template filled in. `values` are plain text except block placeholders,
 * which are HTML from the sender. app_name is added when missing. Pass
 * `content` to render unsaved wording (the editor's test email).
 */
export async function renderTemplate(
  def: EmailTemplateDef,
  values: Record<string, string>,
  content?: EmailTemplateContent,
): Promise<RenderedTemplate> {
  const c = content ?? (await getTemplateContent(def));
  const all = { app_name: values.app_name ?? (await getAppName()), ...values };
  // sendAppEmail escapes these, so they're filled as plain text.
  const text = (s: string) => fillTemplate(def, s, all, "text").replace(/\s+/g, " ").trim();
  return {
    subject: text(c.subject),
    heading: text(c.heading),
    bodyHtml: fillTemplate(def, emailBodyHtml(c.bodyHtml), all, "html"),
    buttonLabel: c.buttonLabel === null ? null : text(c.buttonLabel),
    footerNote: text(c.footerNote),
  };
}
