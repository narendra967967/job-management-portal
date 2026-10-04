import "server-only";

// The single entry point for all JMP email — user side and admin side alike.
// Wraps the low-level SMTP sender (lib/mailer) in a consistent, branded template
// so every message looks the same and automatically carries the app name + a
// plain-text fallback. Use sendAppEmail() everywhere; reach for sendMail()
// directly only when you need full control of the raw HTML.

import { sendMail, isMailConfigured, SMTP_NOT_CONFIGURED } from "@/lib/mailer";
import { getAppName, getSupportEmail } from "@/lib/branding";

export { isMailConfigured, SMTP_NOT_CONFIGURED };

const BRAND = "#4F46E5"; // primary indigo (matches the app)

export interface AppEmailButton {
  label: string;
  url: string;
}

export interface AppEmailOptions {
  to: string;
  subject: string;
  /** Large title at the top of the message body. */
  heading?: string;
  /** Convenience: each string becomes a paragraph (plain text, auto-escaped). */
  lines?: string[];
  /** Raw inner HTML for the body — use when you need custom markup (tables etc.).
   *  The caller is responsible for escaping any user-supplied content. */
  bodyHtml?: string;
  /** Optional call-to-action button. */
  button?: AppEmailButton;
  /** Extra note shown in the footer, above the app-name line. */
  footerNote?: string;
  /** Explicit plain-text body; auto-derived from the above when omitted. */
  text?: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHtml(opts: AppEmailOptions, appName: string, supportEmail: string): string {
  const paras = (opts.lines ?? [])
    .map(
      (l) =>
        `<p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#374151;">${esc(l)}</p>`,
    )
    .join("");

  const heading = opts.heading
    ? `<h1 style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:#111827;">${esc(opts.heading)}</h1>`
    : "";

  const button = opts.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="border-radius:8px;background:${BRAND};">
         <a href="${esc(opts.button.url)}" style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">${esc(opts.button.label)}</a>
       </td></tr></table>`
    : "";

  const support = supportEmail
    ? ` Questions? Reach us at <a href="mailto:${esc(supportEmail)}" style="color:${BRAND};text-decoration:none;">${esc(supportEmail)}</a>.`
    : "";
  const footerNote = opts.footerNote ? `${esc(opts.footerNote)}` : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f7;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr><td style="background:${BRAND};padding:18px 28px;">
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;letter-spacing:0.2px;">${esc(appName)}</span>
          </td></tr>
          <tr><td style="padding:28px;">
            ${heading}
            ${opts.bodyHtml ?? ""}
            ${paras}
            ${button}
          </td></tr>
          <tr><td style="padding:18px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#6b7280;">
            ${footerNote}${footerNote && support ? "<br>" : ""}${support}
            ${footerNote || support ? "<br>" : ""}© ${new Date().getFullYear()} ${esc(appName)}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function renderText(opts: AppEmailOptions, appName: string): string {
  if (opts.text) return opts.text;
  const parts: string[] = [];
  if (opts.heading) parts.push(opts.heading);
  if (opts.lines?.length) parts.push(opts.lines.join("\n\n"));
  if (!opts.lines?.length && opts.bodyHtml) {
    // Best-effort plain text from custom HTML.
    parts.push(opts.bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  }
  if (opts.button) parts.push(`${opts.button.label}: ${opts.button.url}`);
  parts.push(`— ${appName}`);
  return parts.filter(Boolean).join("\n\n");
}

/** Build the branded HTML + plain-text for an email without sending it (used by
 *  sendAppEmail, and handy for previews/tests). */
export async function renderAppEmail(opts: AppEmailOptions): Promise<{ html: string; text: string }> {
  const [appName, supportEmail] = await Promise.all([getAppName(), getSupportEmail()]);
  return { html: renderHtml(opts, appName, supportEmail), text: renderText(opts, appName) };
}

/**
 * Send a branded JMP email. Resolves the app name + support email for the
 * template, builds the HTML + a plain-text fallback, and sends via the global
 * SMTP config. Throws SMTP_NOT_CONFIGURED when SMTP isn't set up (callers decide
 * whether that's fatal).
 */
export async function sendAppEmail(opts: AppEmailOptions): Promise<void> {
  const { html, text } = await renderAppEmail(opts);
  await sendMail({ to: opts.to, subject: opts.subject, html, text });
}
