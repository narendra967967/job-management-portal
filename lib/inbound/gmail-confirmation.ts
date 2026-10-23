// Reads Gmail's forwarding-confirmation email (pure, testable on its own).
// The caller has already checked it really comes from Google (DKIM/ARC).

import type { ParsedMail } from "mailparser";

type ConfirmMail = Pick<ParsedMail, "subject" | "text" | "html">;

/** Every http(s) URL in the email: plain text, the HTML's visible text and
 *  its href attributes (where the real address hides behind "click here"). */
function emailUrls(parsed: ConfirmMail): string[] {
  const html = typeof parsed.html === "string" ? parsed.html.replace(/&amp;/gi, "&") : "";
  const haystack = `${parsed.text ?? ""}\n${html}`;
  return [...new Set([...haystack.matchAll(/https?:\/\/[^\s"'<>]+/g)].map((m) => m[0]))];
}

/** Gmail's verify link — /vf-… on a google.com host. The cancel link (/uf-…)
 *  never qualifies. */
function isVerifyLink(raw: string): boolean {
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    return (
      u.protocol === "https:" &&
      (host === "google.com" || host.endsWith(".google.com")) &&
      /\/vf-/.test(u.pathname) &&
      raw.length <= 2000
    );
  } catch {
    return false;
  }
}

/** What Gmail's forwarding-confirmation email asks the user to do. Current
 *  emails carry a verify link (mail-settings.google.com/mail/vf-…) plus a
 *  cancel link (…/uf-…), which is never picked; older/other formats carry a
 *  numeric code. Null when neither is present. */
export function gmailConfirmation(parsed: ConfirmMail): {
  gmailCode: string | null;
  gmailConfirmUrl: string | null;
  gmailConfirmFrom: string | null;
} | null {
  const html = typeof parsed.html === "string" ? parsed.html : "";
  const text = `${parsed.text ?? ""}\n${html.replace(/<[^>]+>/g, " ")}`;
  const gmailConfirmUrl = emailUrls(parsed).find(isVerifyLink) ?? null;
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

/** Content-free outline of a confirmation email we couldn't read, for the
 *  admin log: which parts it had and the shape of its links (tokens masked),
 *  e.g. "text 812 B, html none; links mail-settings.google.com/mail/vf-* ×1". */
export function describeConfirmationEmail(parsed: ConfirmMail): string {
  const html = typeof parsed.html === "string" ? parsed.html : "";
  const kinds = new Map<string, number>();
  for (const raw of emailUrls(parsed)) {
    let key: string;
    try {
      const u = new URL(raw);
      const path = u.pathname
        .split("/")
        .map((seg) => (seg.length > 12 ? `${seg.slice(0, 3)}*` : seg))
        .join("/")
        .slice(0, 40);
      key = `${u.hostname}${path}`;
    } catch {
      key = "unparseable";
    }
    kinds.set(key, (kinds.get(key) ?? 0) + 1);
  }
  const links = [...kinds].map(([k, n]) => `${k} ×${n}`).join(", ") || "none";
  return `text ${parsed.text ? `${parsed.text.length} ch` : "none"}, html ${html ? `${html.length} ch` : "none"}; links ${links}`;
}
