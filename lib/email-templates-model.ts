// Email templates: every email the system sends on its own, with wording an
// admin can change (Engagement → Email templates). Client-safe: the registry,
// default wording, placeholders and the checks/fill used by both the editor and
// the senders.
//
// RULE: any new automatic email gets an entry here and its sender fills it, so
// admins control its content. Broadcasts and the SMTP test email are the only
// exceptions. Links (confirm, reset, …) are never part of the editable text:
// the sender makes them and the button carries them.

import { z } from "zod";

export type EmailTemplateGroup = "Sign-in" | "Confirmation codes" | "Account" | "Plans and payments" | "Leads" | "Support";

export const EMAIL_TEMPLATE_GROUPS: EmailTemplateGroup[] = [
  "Sign-in",
  "Confirmation codes",
  "Account",
  "Plans and payments",
  "Leads",
  "Support",
];

export interface TemplatePlaceholder {
  key: string;
  /** What it becomes, for the chip's tooltip. */
  label: string;
  /** Used in Preview and test emails. */
  sample: string;
  /** The email doesn't make sense without it, so saving needs it somewhere. */
  required?: boolean;
  /** Filled with ready-made HTML (a table, a conversation); body only. */
  block?: boolean;
}

export interface EmailTemplateContent {
  subject: string;
  heading: string;
  bodyHtml: string;
  /** Null when the email has no button. */
  buttonLabel: string | null;
  footerNote: string;
}

/** Every automatic email. A new one gets a key here and an entry in EMAIL_TEMPLATES. */
export type EmailTemplateKey =
  | "verify_email"
  | "welcome_set_password"
  | "reset_password"
  | "code_reset_leads"
  | "code_delete_account"
  | "leads_reset_done"
  | "deletion_received"
  | "deletion_canceled"
  | "account_deleted"
  | "plan_ending"
  | "payment_received"
  | "old_leads_cleared"
  | "ticket_received"
  | "ticket_resolved"
  | "reactivation_request";

export interface EmailTemplateDef {
  key: EmailTemplateKey;
  group: EmailTemplateGroup;
  name: string;
  /** When it goes out, in a few words. */
  trigger: string;
  recipient: "user" | "support";
  placeholders: TemplatePlaceholder[];
  defaults: EmailTemplateContent;
}

export const SUBJECT_MAX = 150;
export const HEADING_MAX = 150;
export const BUTTON_MAX = 40;
export const FOOTER_MAX = 300;
export const BODY_MAX = 20_000;
/** Versions kept per email, for Restore. */
export const TEMPLATE_VERSIONS_KEPT = 5;

const APP: TemplatePlaceholder = { key: "app_name", label: "Your app's name", sample: "Jobtiva" };
const NAME: TemplatePlaceholder = { key: "user_name", label: "The user's first name, or \"there\"", sample: "Priya" };
const EMAIL: TemplatePlaceholder = { key: "user_email", label: "The user's email address", sample: "priya@example.com" };
const TICKET: TemplatePlaceholder = { key: "ticket_number", label: "The support ticket's number", sample: "TKT-0042" };

const CODE_BLOCK =
  '<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0">482913</p>';

const p = (...lines: string[]) => lines.map((l) => `<p>${l}</p>`).join("");

export const EMAIL_TEMPLATES: EmailTemplateDef[] = [
  /* ---------------- Sign-in ---------------- */
  {
    key: "verify_email",
    group: "Sign-in",
    name: "Confirm your email",
    trigger: "Someone signs up, or signs in before confirming",
    recipient: "user",
    placeholders: [APP, NAME, EMAIL, { key: "link_hours", label: "How long the link works, in hours", sample: "24" }],
    defaults: {
      subject: "Verify your email for {{app_name}}",
      heading: "Confirm your email",
      bodyHtml: p(
        "Hi {{user_name}}, welcome to {{app_name}}!",
        "Confirm your email address to activate your account. This link works for {{link_hours}} hours, and signing in sends a new one if it runs out.",
      ),
      buttonLabel: "Verify email",
      footerNote: "If you didn't create this account, you can safely ignore this email.",
    },
  },
  {
    key: "welcome_set_password",
    group: "Sign-in",
    name: "Welcome: set your password",
    trigger: "An admin creates an account",
    recipient: "user",
    placeholders: [APP, NAME, EMAIL],
    defaults: {
      subject: "Welcome to {{app_name}}: set your password",
      heading: "Welcome to {{app_name}}",
      bodyHtml: p(
        "Hi {{user_name}}, an administrator created an account for you on {{app_name}}.",
        "Your login ID is {{user_email}}.",
        "Click below to set your password and sign in. This link expires in 1 hour. If it does, use “Forgot password” on the sign-in page to get a new one.",
      ),
      buttonLabel: "Set your password",
      footerNote: "Once you're signed in, you can change your password anytime from Settings → Account.",
    },
  },
  {
    key: "reset_password",
    group: "Sign-in",
    name: "Reset your password",
    trigger: "Someone uses Forgot password",
    recipient: "user",
    placeholders: [APP, NAME, EMAIL],
    defaults: {
      subject: "Reset your {{app_name}} password",
      heading: "Reset your password",
      bodyHtml: p(
        "We received a request to reset your {{app_name}} password.",
        "Click the button below to choose a new one. This link expires in 1 hour.",
      ),
      buttonLabel: "Reset your password",
      footerNote: "If you didn't request this, you can safely ignore this email.",
    },
  },

  /* ---------------- Confirmation codes ---------------- */
  {
    key: "code_reset_leads",
    group: "Confirmation codes",
    name: "Code to reset your leads",
    trigger: "A user starts Reset leads in Settings → Account",
    recipient: "user",
    placeholders: [
      APP,
      NAME,
      { key: "code", label: "The 6-digit code, shown large", sample: CODE_BLOCK, required: true, block: true },
      { key: "minutes", label: "How long the code works, in minutes", sample: "10" },
    ],
    defaults: {
      subject: "Your code to reset your leads",
      heading: "Confirm resetting your leads",
      bodyHtml:
        "<p>Use this code to permanently delete all your leads and everything attached to them:</p>{{code}}" +
        "<p>It expires in {{minutes}} minutes. If you didn't ask for this, ignore this email and change your password.</p>",
      buttonLabel: null,
      footerNote: "",
    },
  },
  {
    key: "code_delete_account",
    group: "Confirmation codes",
    name: "Code to request account deletion",
    trigger: "A user starts Delete account in Settings → Account",
    recipient: "user",
    placeholders: [
      APP,
      NAME,
      { key: "code", label: "The 6-digit code, shown large", sample: CODE_BLOCK, required: true, block: true },
      { key: "minutes", label: "How long the code works, in minutes", sample: "10" },
    ],
    defaults: {
      subject: "Your code to request account deletion",
      heading: "Confirm your account deletion request",
      bodyHtml:
        "<p>Use this code to send a request to delete your account and all its data:</p>{{code}}" +
        "<p>It expires in {{minutes}} minutes. If you didn't ask for this, ignore this email and change your password.</p>",
      buttonLabel: null,
      footerNote: "",
    },
  },

  /* ---------------- Account ---------------- */
  {
    key: "leads_reset_done",
    group: "Account",
    name: "Your leads have been reset",
    trigger: "A user confirms Reset leads",
    recipient: "user",
    placeholders: [APP, NAME, { key: "leads_deleted", label: "How many were deleted, e.g. \"12 leads\"", sample: "12 leads" }],
    defaults: {
      subject: "Your leads have been reset",
      heading: "Your leads have been reset",
      bodyHtml: p(
        "We permanently deleted {{leads_deleted}} and everything attached to them, as you asked.",
        "Your account, profile, résumés, settings and email forwarding are unchanged, and new job alerts will keep arriving as fresh leads.",
        "If you didn't do this, change your password and contact support right away.",
      ),
      buttonLabel: null,
      footerNote: "",
    },
  },
  {
    key: "deletion_received",
    group: "Account",
    name: "Deletion request received",
    trigger: "A user confirms Delete account",
    recipient: "user",
    placeholders: [APP, NAME, TICKET],
    defaults: {
      subject: "We've received your account deletion request",
      heading: "Deletion request received",
      bodyHtml: p(
        "We've received your request to delete your account ({{ticket_number}}).",
        "Our team will delete your account and all its data, and email you when it's done. Until then you can keep using it.",
        "Changed your mind? Cancel the request in Settings → Account.",
      ),
      buttonLabel: null,
      footerNote: "",
    },
  },
  {
    key: "deletion_canceled",
    group: "Account",
    name: "Deletion request canceled",
    trigger: "A user cancels their deletion request",
    recipient: "user",
    placeholders: [APP, NAME, TICKET],
    defaults: {
      subject: "Thanks for staying with us",
      heading: "Thanks for staying",
      bodyHtml: p(
        "Hi {{user_name}}, you've canceled your account deletion request ({{ticket_number}}). Your account and all your data stay exactly as they are.",
        "We're glad you're staying. If something wasn't working for you, tell us from Help & support and we'll do our best to make it better.",
      ),
      buttonLabel: null,
      footerNote: "",
    },
  },
  {
    key: "account_deleted",
    group: "Account",
    name: "Your account has been deleted",
    trigger: "An admin deletes an account the user asked to delete",
    recipient: "user",
    placeholders: [APP, NAME],
    defaults: {
      subject: "Your account has been deleted",
      heading: "Your account has been deleted",
      bodyHtml: p(
        "Hi {{user_name}}, as you asked, we've permanently deleted your account and all its data: leads, contacts, résumés, profile and settings.",
        "This can't be undone. You're welcome to sign up again any time.",
      ),
      buttonLabel: null,
      footerNote: "",
    },
  },

  /* ---------------- Plans and payments ---------------- */
  {
    key: "plan_ending",
    group: "Plans and payments",
    name: "Your plan ends soon",
    trigger: "Daily, in the last 7 days of a plan or free trial",
    recipient: "user",
    placeholders: [
      APP,
      NAME,
      { key: "plan_label", label: "\"Pro plan\", or \"free trial\"", sample: "Pro plan" },
      { key: "ends_on", label: "The end date", sample: "November 15, 2026" },
      { key: "ends_when", label: "\"tomorrow\", or \"in 3 days\"", sample: "in 3 days" },
      {
        key: "leads_line",
        label: "How many leads they're tracking, and why to renew (written by the app)",
        sample: "<p>You're tracking 24 job leads right now. Renew before then and nothing changes: your leads, contacts and reminders stay right where they are.</p>",
        block: true,
      },
      {
        key: "upgrade_line",
        label: "The next plan up and its price, when there is one (written by the app)",
        sample: "<p>Thinking about more room? Premium adds AI outreach drafts and résumé ATS checks. It's ₹499 a month. If you upgrade now, the days left on your current plan count toward it.</p>",
        block: true,
      },
      { key: "button_text", label: "\"Choose a plan\", \"Renew my plan\" or \"Renew or upgrade\", whichever fits", sample: "Renew or upgrade" },
    ],
    defaults: {
      subject: "Your {{plan_label}} ends {{ends_when}}",
      heading: "Your {{plan_label}} ends {{ends_when}}",
      bodyHtml:
        "<p>Hi {{user_name}}, your {{plan_label}} ends on {{ends_on}}.</p>{{leads_line}}{{upgrade_line}}" +
        "<p>If it does run out, you can still sign in to {{app_name}}, but everything apart from your plan and account settings stays locked until you pick a plan.</p>",
      buttonLabel: "{{button_text}}",
      footerNote: "We send this once a day during the last week of your plan, and stop as soon as you renew.",
    },
  },
  {
    key: "payment_received",
    group: "Plans and payments",
    name: "Payment received",
    trigger: "A plan payment succeeds, or an admin resends the receipt",
    recipient: "user",
    placeholders: [
      APP,
      NAME,
      { key: "plan_name", label: "The plan they paid for", sample: "Pro" },
      { key: "active_until", label: "The date the plan now runs to", sample: "December 8, 2026" },
      { key: "total_paid", label: "The amount paid", sample: "₹499.00" },
      {
        key: "receipt_details",
        label: "The receipt table: number, date, plan, tax, total, payment ID",
        sample:
          '<table style="width:100%;border-collapse:collapse;margin:8px 0 18px;font-size:14px"><tr><td style="padding:7px 0;border-bottom:1px solid #E5E7EB;color:#6B7280">Receipt number</td><td style="padding:7px 0;border-bottom:1px solid #E5E7EB;text-align:right">RCPT-0007</td></tr><tr><td style="padding:7px 0;border-bottom:1px solid #E5E7EB;color:#6B7280">Total paid</td><td style="padding:7px 0;border-bottom:1px solid #E5E7EB;text-align:right;font-weight:bold">₹499.00</td></tr></table>',
        required: true,
        block: true,
      },
    ],
    defaults: {
      subject: "Payment received: {{plan_name}} plan",
      heading: "Payment received",
      bodyHtml: "<p>Hi {{user_name}}, thanks for your payment. Your {{plan_name}} plan is active until {{active_until}}.</p>{{receipt_details}}",
      buttonLabel: "See your plan",
      footerNote: "Keep this email as your payment receipt.",
    },
  },

  /* ---------------- Leads ---------------- */
  {
    key: "old_leads_cleared",
    group: "Leads",
    name: "Old leads cleared",
    trigger: "Lead retention removes a user's old leads",
    recipient: "user",
    placeholders: [
      APP,
      NAME,
      { key: "leads_removed", label: "How many, e.g. \"12 old leads\"", sample: "12 old leads" },
      {
        key: "removed_by_status",
        label: "A small table: how many per status",
        sample: '<table style="margin:0 0 14px"><tr><td style="padding:4px 12px 4px 0">Closed</td><td><b>9</b></td></tr><tr><td style="padding:4px 12px 4px 0">Discarded</td><td><b>3</b></td></tr></table>',
        block: true,
      },
      { key: "statuses", label: "The statuses the rule covers", sample: "Closed, Discarded" },
      { key: "days", label: "Days without activity before removal", sample: "180" },
    ],
    defaults: {
      subject: "Old leads cleared from your account",
      heading: "Automatic cleanup of old leads",
      bodyHtml:
        "<p>We removed {{leads_removed}} from your account as part of routine cleanup.</p>{{removed_by_status}}" +
        "<p>Leads marked {{statuses}} with no activity for {{days}} days or more are removed automatically.</p>" +
        "<p>This keeps your workspace tidy, and there's nothing you need to do.</p>",
      buttonLabel: null,
      footerNote: "",
    },
  },

  /* ---------------- Support ---------------- */
  {
    key: "ticket_received",
    group: "Support",
    name: "We got your request",
    trigger: "A user contacts support",
    recipient: "user",
    placeholders: [
      APP,
      NAME,
      { key: "ticket_subject", label: "The request's subject", sample: "Can't see my new leads" },
      { key: "your_message", label: "What they wrote", sample: "<p>Alerts arrive in Gmail but no leads appear since Monday.</p>", block: true },
    ],
    defaults: {
      subject: "We got your request: {{ticket_subject}}",
      heading: "Thanks, we've received your request",
      bodyHtml:
        "<p>Our team will review it and reply from your account. You can follow the conversation any time under <strong>Settings → Help &amp; support</strong>.</p>" +
        "<p><strong>Your message</strong></p>{{your_message}}",
      buttonLabel: null,
      footerNote: "You're receiving this because you contacted support from your account.",
    },
  },
  {
    key: "ticket_resolved",
    group: "Support",
    name: "Your request has been resolved",
    trigger: "An admin marks a ticket resolved",
    recipient: "user",
    placeholders: [
      APP,
      NAME,
      { key: "ticket_subject", label: "The request's subject", sample: "Can't see my new leads" },
      {
        key: "conversation",
        label: "The whole conversation, every message with its date",
        sample:
          '<div style="margin:0 0 14px"><p style="margin:0 0 4px;font-size:12px;color:#6b7280">You wrote · Nov 6, 2026, 9:12 AM</p><div style="border-left:3px solid #e5e7eb;padding-left:10px">Alerts arrive in Gmail but no leads appear.</div></div><div style="margin:0 0 14px"><p style="margin:0 0 4px;font-size:12px;color:#6b7280">Support replied · Nov 6, 2026, 11:40 AM</p><div style="border-left:3px solid #e5e7eb;padding-left:10px">Your Gmail filter had paused. It\'s back on now.</div></div>',
        required: true,
        block: true,
      },
    ],
    defaults: {
      subject: "Resolved: {{ticket_subject}}",
      heading: "Your request has been resolved",
      bodyHtml:
        "<p>Hi {{user_name}}, we've marked your request “<strong>{{ticket_subject}}</strong>” as resolved. Here's the full conversation for your records:</p>{{conversation}}" +
        "<p>Still need help? Contact support again and we'll reopen it.</p>",
      buttonLabel: null,
      footerNote: "",
    },
  },
  {
    key: "reactivation_request",
    group: "Support",
    name: "Reactivation request (to your support inbox)",
    trigger: "A deactivated user asks to be reactivated",
    recipient: "support",
    placeholders: [
      APP,
      { key: "user_name", label: "The user's full name", sample: "Priya Sharma" },
      EMAIL,
      {
        key: "user_details",
        label: "A table: name, email, mobile, user ID, when",
        sample: '<table cellpadding="4"><tr><td><b>Email</b></td><td>priya@example.com</td></tr><tr><td><b>Mobile</b></td><td>+91 98xxxxxx10</td></tr></table>',
        block: true,
      },
      { key: "message", label: "What they wrote", sample: "<p>I'd like to use my account again, please.</p>", block: true },
    ],
    defaults: {
      subject: "Reactivation request: {{user_name}}",
      heading: "Account reactivation request",
      bodyHtml: "<p><strong>{{user_name}}</strong> has asked for their account to be reactivated.</p>{{user_details}}<p><strong>Message</strong></p>{{message}}",
      buttonLabel: null,
      footerNote: "",
    },
  },
];

export const templateByKey = (key: string) => EMAIL_TEMPLATES.find((t) => t.key === key);

/* ---------------- placeholders: find, check, fill ---------------- */

const TOKEN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export const placeholdersIn = (text: string) => [...text.matchAll(TOKEN)].map((m) => m[1]);

export type TemplateField = "subject" | "heading" | "bodyHtml" | "buttonLabel" | "footerNote";

export interface TemplateProblem {
  field: TemplateField;
  message: string;
}

const textOnly = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

/** Everything that would stop this content from being saved, per field. */
export function templateProblems(def: EmailTemplateDef, c: EmailTemplateContent): TemplateProblem[] {
  const out: TemplateProblem[] = [];
  const known = new Map(def.placeholders.map((ph) => [ph.key, ph]));
  const fields: [TemplateField, string, number, boolean][] = [
    ["subject", c.subject, SUBJECT_MAX, true],
    ["heading", c.heading, HEADING_MAX, false],
    ["bodyHtml", c.bodyHtml, BODY_MAX, true],
    ["buttonLabel", c.buttonLabel ?? "", BUTTON_MAX, def.defaults.buttonLabel !== null],
    ["footerNote", c.footerNote, FOOTER_MAX, false],
  ];
  for (const [field, value, max, needed] of fields) {
    if (needed && !(field === "bodyHtml" ? textOnly(value) || placeholdersIn(value).length : value.trim())) {
      out.push({ field, message: field === "bodyHtml" ? "Write the message." : "This can't be empty." });
      continue;
    }
    if (value.length > max) out.push({ field, message: `Keep it under ${max.toLocaleString("en-US")} characters.` });
    for (const k of placeholdersIn(value)) {
      const ph = known.get(k);
      if (!ph) out.push({ field, message: `{{${k}}} isn't available in this email.` });
      else if (ph.block && field !== "bodyHtml") out.push({ field, message: `{{${k}}} can only go in the message.` });
    }
  }
  const used = new Set(fields.flatMap(([, v]) => placeholdersIn(v)));
  for (const ph of def.placeholders) {
    if (ph.required && !used.has(ph.key)) {
      out.push({ field: "bodyHtml", message: `This email needs {{${ph.key}}}: ${ph.label.toLowerCase()}.` });
    }
  }
  return out;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/**
 * Puts the values in. In HTML fields ordinary values are escaped, so a user's
 * name can't add markup; block values are the sender's own HTML. In plain-text
 * fields (subject, button, footer) values go in as they are.
 */
export function fillTemplate(
  def: EmailTemplateDef,
  text: string,
  values: Record<string, string>,
  mode: "html" | "text",
): string {
  const blocks = new Set(def.placeholders.filter((ph) => ph.block).map((ph) => ph.key));
  return text.replace(TOKEN, (_, k: string) => {
    const v = values[k] ?? "";
    return mode === "html" && !blocks.has(k) ? esc(v) : v;
  });
}

/** Sample values, for Preview and test emails. */
export const sampleValues = (def: EmailTemplateDef) =>
  Object.fromEntries(def.placeholders.map((ph) => [ph.key, ph.sample]));

export const sameContent = (a: EmailTemplateContent, b: EmailTemplateContent) =>
  a.subject === b.subject &&
  a.heading === b.heading &&
  a.bodyHtml === b.bodyHtml &&
  (a.buttonLabel ?? "") === (b.buttonLabel ?? "") &&
  a.footerNote === b.footerNote;

/* ---------------- saved state (DB rows, as the admin screens get them) ---------------- */


/** Shape check for wording coming in from the editor (templateProblems does the rest). */
export const emailTemplateContentSchema = z.object({
  subject: z.string().max(SUBJECT_MAX * 2),
  heading: z.string().max(HEADING_MAX * 2),
  bodyHtml: z.string().max(BODY_MAX * 2),
  buttonLabel: z.string().max(BUTTON_MAX * 2).nullable(),
  footerNote: z.string().max(FOOTER_MAX * 2),
});

/** One email's current wording. */
export interface TemplateState {
  key: string;
  content: EmailTemplateContent;
  /** The wording differs from the built-in default. */
  edited: boolean;
  /** Last save or reset, and who did it. */
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Wording an email had before a save or reset. */
export interface TemplateVersion {
  id: string;
  content: EmailTemplateContent;
  savedAt: string;
  savedBy: string | null;
  /** The built-in wording, kept when the first edit replaced it. */
  isDefault: boolean;
}

export interface TemplateRow extends TemplateState {
  def: EmailTemplateDef;
}

/** {{user_name}}: the first word of the user's name, or "there" ("Hi there"). */
export const greetingName = (name?: string | null) => name?.trim().split(/\s+/)[0] || "there";
