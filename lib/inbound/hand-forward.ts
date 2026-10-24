// Hand-forwarded job alerts: a user opens an alert in their mailbox and
// forwards it to their Jobtiva address themselves (e.g. a work account that
// blocks automatic forwarding). The email then comes FROM the user, so we find
// the original inside it: an attached message/rfc822, or the inline
// "---------- Forwarded message ---------" block Gmail and others write.
// Pure apart from parsing an attachment — testable on its own.

import { simpleParser, type ParsedMail } from "mailparser";

export interface ForwardedOriginal {
  /** The original sender, lowercase — checked against the allowed senders. */
  from: string;
  subject: string;
  html: string | false;
  text: string;
}

function bareAddress(v: string | undefined | null): string {
  const m = /([^\s<>"'()@]+@[^\s<>"'()@]+\.[a-z]{2,})/i.exec(v ?? "");
  return m ? m[1].toLowerCase() : "";
}

export async function forwardedOriginal(
  mail: Pick<ParsedMail, "subject" | "text" | "html" | "attachments">,
): Promise<ForwardedOriginal | null> {
  // "Forward as attachment": the original travels whole.
  for (const a of mail.attachments ?? []) {
    if (a.contentType?.toLowerCase() !== "message/rfc822") continue;
    try {
      const inner = await simpleParser(a.content, { skipImageLinks: true, skipTextToHtml: true });
      const from = bareAddress(inner.from?.value?.[0]?.address);
      if (from) return { from, subject: inner.subject ?? "", html: inner.html ?? false, text: inner.text ?? "" };
    } catch {
      // Not a readable message — try the inline form below.
    }
  }

  // Inline forward: the header block right after the marker names the sender.
  const html = typeof mail.html === "string" ? mail.html : "";
  const text =
    mail.text ||
    html
      .replace(/<br\s*\/?>|<\/(p|div|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&amp;/gi, "&")
      .replace(/&nbsp;/gi, " ");
  const marker = text.search(/-{2,}\s*(?:Forwarded message|Original Message)\s*-{2,}|^Begin forwarded message:/im);
  if (marker < 0) return null;
  const block = text.slice(marker, marker + 1200);
  const from = bareAddress(/^\s*From:\s*(.+)$/im.exec(block)?.[1]);
  if (!from) return null;
  const subject =
    /^\s*Subject:\s*(.+)$/im.exec(block)?.[1]?.trim() ?? (mail.subject ?? "").replace(/^\s*(fwd?|fw):\s*/i, "");
  // The forwarded body keeps the original's HTML below the header block, so
  // the same readers (and the AI) work on the whole email.
  return { from, subject, html: mail.html ?? false, text: mail.text ?? "" };
}
