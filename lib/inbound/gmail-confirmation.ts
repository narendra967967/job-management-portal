// Reads Gmail's forwarding-confirmation email (pure, testable on its own).
// The caller has already checked it really comes from Google (DKIM/ARC).

import type { ParsedMail } from "mailparser";

/** What Gmail's forwarding-confirmation email asks the user to do. Current
 *  emails carry a verify link (mail-settings.google.com/mail/vf-…) plus a
 *  cancel link (…/uf-…), which is never picked; older/other formats carry a
 *  numeric code. Null when neither is present. */
export function gmailConfirmation(parsed: Pick<ParsedMail, "subject" | "text" | "html">): {
  gmailCode: string | null;
  gmailConfirmUrl: string | null;
  gmailConfirmFrom: string | null;
} | null {
  const html = typeof parsed.html === "string" ? parsed.html : "";
  const text = `${parsed.text ?? ""}\n${html.replace(/<[^>]+>/g, " ")}`;
  const urls = [...text.matchAll(/https:\/\/mail-settings\.google\.com\/mail\/vf-[^\s"'<>]+/g)].map((m) => m[0]);
  const gmailConfirmUrl = urls.find((u) => u.length <= 2000) ?? null;
  const gmailCode =
    /\(#(\d{6,12})\)/.exec(parsed.subject ?? "")?.[1] ??
    /confirmation code[^0-9]{0,40}(\d{6,12})/i.exec(text)?.[1] ??
    null;
  if (!gmailConfirmUrl && !gmailCode) return null;
  const requester =
    /([^\s<>()"]+@[^\s<>()"]+)\s+has requested to automatically forward/i.exec(text)?.[1] ??
    /Receive Mail from\s+([^\s<>()"]+@[^\s<>()"]+)/i.exec(parsed.subject ?? "")?.[1] ??
    null;
  return { gmailCode, gmailConfirmUrl, gmailConfirmFrom: requester?.toLowerCase().slice(0, 254) ?? null };
}
