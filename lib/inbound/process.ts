import "server-only";

// Email forwarding — process one received email (spec: docs/email-forwarding.md).
//
//   recipient check (RCPT) → size → parse MIME → Gmail confirmation (link/code)?
//   → sender allow-list → DKIM (or Gmail's ARC seal) for the allowed signing
//   domain → dedupe (RFC Message-ID, shared with Connect Gmail) → parser →
//   leads → address timestamps → log (metadata only).
//
// SMTP outcome policy (load-safe, no bounce spam):
//   - unknown recipient → 550 at RCPT (no body is ever received);
//   - forwarding switched off → 451 (senders retry later);
//   - everything else that we could process → 250, including mail we drop by
//     policy (not allowed, failed signature) — dropping silently avoids
//     Gmail sending bounce notices to the user and gives probers no signal;
//   - unexpected errors → thrown → the route answers 451 so the sender retries.

import { eq, sql } from "drizzle-orm";
import { simpleParser, type ParsedMail } from "mailparser";
import { authenticate } from "mailauth";
import { db } from "@/lib/db";
import {
  gmailIngestErrors as errorsT,
  gmailProcessedMessages as processedT,
  inboundAddresses as addressesT,
  inboundEmailLog as logT,
} from "@/db/schema";
import { getIntakeConfig, loadSenders, receivingDomain, userIdForToken } from "@/lib/email-intake-data";
import { domainWithin, type InboundSender, type InboundStatus } from "@/lib/email-intake-model";
import { parseLinkedInAlert } from "@/lib/linkedin-parser";
import { ingestAlertDrafts } from "@/lib/lead-ingest";
import { confirmationText, describeConfirmationEmail, gmailConfirmation } from "@/lib/inbound/gmail-confirmation";

export type SmtpOutcome = { code: 250 | 451 | 550; message: string };

const GMAIL_CONFIRM_FROM = "forwarding-noreply@google.com";
const GMAIL_CONFIRM_DOMAIN = "google.com";

/** "Name <a@b.com>" / "a@b.com" → "a@b.com" (lowercase), or "" */
function bareAddress(v: string | undefined | null): string {
  const m = /<?([^<>\s@]+@[^<>\s@]+)>?\s*$/.exec((v ?? "").trim());
  return m ? m[1].toLowerCase() : "";
}

function domainOf(address: string): string {
  const at = address.lastIndexOf("@");
  return at >= 0 ? address.slice(at + 1).toLowerCase() : "unknown";
}

/** Local part of `<token>@<receiving domain>` when the domain is ours. */
export function tokenFromRecipient(recipient: string): string | null {
  const addr = bareAddress(recipient);
  const at = addr.lastIndexOf("@");
  if (at < 1) return null;
  if (addr.slice(at + 1) !== receivingDomain()) return null;
  return addr.slice(0, at);
}

async function log(entry: {
  userId: string | null;
  status: InboundStatus;
  reason: string;
  fromAddress?: string | null;
  fromDomain: string;
  signingDomain?: string | null;
  sizeBytes?: number;
  messageId?: string | null;
  leadsCreated?: number;
}) {
  await db.insert(logT).values({
    userId: entry.userId,
    status: entry.status,
    reason: entry.reason.slice(0, 400),
    // Full sender only for mail we accepted from a verified job site.
    fromAddress: entry.status === "rejected" ? null : (entry.fromAddress ?? null),
    fromDomain: entry.fromDomain.slice(0, 253),
    signingDomain: entry.signingDomain ?? null,
    sizeBytes: entry.sizeBytes ?? 0,
    messageId: entry.messageId?.slice(0, 300) ?? null,
    leadsCreated: entry.leadsCreated ?? 0,
  });
}

/* ---------------- RCPT stage ---------------- */

/** Called by the mail receiver for each RCPT TO. Unknown → 550 before DATA. */
export async function checkRecipient(recipient: string, mailFrom: string): Promise<SmtpOutcome> {
  const config = await getIntakeConfig();
  const token = tokenFromRecipient(recipient);
  const userId = token ? await userIdForToken(token) : null;
  if (!userId) {
    await log({ userId: null, status: "rejected", reason: "Unknown address", fromDomain: domainOf(bareAddress(mailFrom)) });
    return { code: 550, message: "No such recipient" };
  }
  if (!config.forwardingEnabled) return { code: 451, message: "Forwarding is temporarily unavailable" };
  return { code: 250, message: "OK" };
}

/* ---------------- DKIM / ARC ---------------- */

type AuthResult = Awaited<ReturnType<typeof authenticate>>;

/** Does a passing DKIM signature — or Gmail's passing ARC seal recording one —
 *  vouch for `domain`? Returns the vouching signing domain, or null. */
function signedFor(auth: AuthResult, domain: string): string | null {
  for (const r of auth.dkim?.results ?? []) {
    if (r.status?.result === "pass" && r.signingDomain && domainWithin(r.signingDomain, domain)) {
      return r.signingDomain.toLowerCase();
    }
  }
  // Forwarding can break the original signature; Gmail's ARC seal then
  // records what it verified on arrival. Trust it only when the chain passes
  // and the seal is Google's.
  const arc = auth.arc as
    | {
        status?: { result?: string };
        signature?: { signingDomain?: string };
        authenticationResults?: { dkim?: { result?: string; header?: { d?: string; i?: string } }[] };
      }
    | undefined;
  if (arc?.status?.result === "pass" && arc.signature?.signingDomain && domainWithin(arc.signature.signingDomain, "google.com")) {
    for (const d of arc.authenticationResults?.dkim ?? []) {
      const dom = (d.header?.d ?? d.header?.i ?? "").replace(/^.*@/, "").toLowerCase();
      if (d.result === "pass" && dom && domainWithin(dom, domain)) return dom;
    }
  }
  return null;
}

function matchSender(senders: InboundSender[], from: string): InboundSender | null {
  const dom = domainOf(from);
  for (const s of senders) {
    if (!s.enabled) continue;
    if (s.match.startsWith("*@") ? domainWithin(dom, s.match.slice(2)) : s.match === from) return s;
  }
  return null;
}

/* ---------------- DATA stage ---------------- */

export async function processInbound(raw: Buffer, recipient: string): Promise<SmtpOutcome> {
  const config = await getIntakeConfig();
  if (!config.forwardingEnabled) return { code: 451, message: "Forwarding is temporarily unavailable" };

  const token = tokenFromRecipient(recipient);
  const userId = token ? await userIdForToken(token) : null;
  if (!userId) {
    // Address reset between RCPT and DATA, or a direct call.
    await log({ userId: null, status: "rejected", reason: "Unknown address", fromDomain: "unknown", sizeBytes: raw.length });
    return { code: 550, message: "No such recipient" };
  }

  if (raw.length > config.maxBytes) {
    await log({ userId, status: "rejected", reason: "Too large", fromDomain: "unknown", sizeBytes: raw.length });
    return { code: 250, message: "Accepted" };
  }

  let parsed: ParsedMail;
  try {
    parsed = await simpleParser(raw, { skipImageLinks: true, skipTextToHtml: true });
  } catch {
    await log({ userId, status: "rejected", reason: "Malformed email", fromDomain: "unknown", sizeBytes: raw.length });
    return { code: 250, message: "Accepted" };
  }

  const from = bareAddress(parsed.from?.value?.[0]?.address);
  const fromDomain = domainOf(from);
  const messageId = (parsed.messageId ?? "").trim() || null;
  // Only DKIM + ARC are used; skip the DMARC/BIMI DNS lookups.
  const auth = await authenticate(raw, { trustReceived: false, disableDmarc: true, disableBimi: true });

  // Gmail's forwarding-confirmation email → show the link (or code) in Settings.
  if (from === GMAIL_CONFIRM_FROM) {
    const vouched = signedFor(auth, GMAIL_CONFIRM_DOMAIN);
    if (!vouched) {
      await log({ userId, status: "rejected", reason: "Signature check failed", fromDomain, sizeBytes: raw.length });
      return { code: 250, message: "Accepted" };
    }
    // Keep the email itself (plain text) so the user can always confirm by
    // hand; the extracted link/code is the one-click shortcut on top.
    const confirm = gmailConfirmation(parsed);
    const gmailConfirmText = confirmationText(parsed);
    if (!confirm && !gmailConfirmText) {
      await log({ userId, status: "rejected", reason: `Empty confirmation email (${describeConfirmationEmail(parsed)})`, fromDomain, sizeBytes: raw.length });
      return { code: 250, message: "Accepted" };
    }
    await db
      .update(addressesT)
      .set({
        gmailCode: confirm?.gmailCode ?? null,
        gmailConfirmUrl: confirm?.gmailConfirmUrl ?? null,
        gmailConfirmFrom: confirm?.gmailConfirmFrom ?? null,
        gmailConfirmText,
        gmailCodeAt: new Date(),
      })
      .where(eq(addressesT.userId, userId));
    const how = confirm ? "link/code found" : `email shown only — ${describeConfirmationEmail(parsed)}`;
    await log({ userId, status: "gmail_code", reason: `Gmail confirmation shown to user (${how})`, fromAddress: from, fromDomain, signingDomain: vouched, sizeBytes: raw.length, messageId });
    return { code: 250, message: "Accepted" };
  }

  const sender = matchSender(await loadSenders(), from);
  if (!sender) {
    await log({ userId, status: "rejected", reason: "Sender not allowed", fromDomain, sizeBytes: raw.length });
    return { code: 250, message: "Accepted" };
  }

  const vouched = signedFor(auth, sender.signingDomain);
  if (!vouched) {
    await log({ userId, status: "rejected", reason: "Signature check failed", fromDomain, sizeBytes: raw.length });
    return { code: 250, message: "Accepted" };
  }

  // From here the sender is verified — it counts as forwarding working.
  await db
    .update(addressesT)
    .set({
      lastReceivedAt: new Date(),
      firstReceivedAt: sql`coalesce(${addressesT.firstReceivedAt}, now())`,
      confirmedAt: sql`coalesce(${addressesT.confirmedAt}, now())`,
      gmailConfirmText: null,
    })
    .where(eq(addressesT.userId, userId));

  const base = { userId, fromAddress: from, fromDomain, signingDomain: vouched, sizeBytes: raw.length, messageId };

  if (messageId) {
    const claimed = await db
      .insert(processedT)
      .values({ userId, messageId })
      .onConflictDoNothing()
      .returning({ messageId: processedT.messageId });
    if (!claimed.length) {
      await log({ ...base, status: "duplicate", reason: "Already processed" });
      return { code: 250, message: "Accepted" };
    }
  }

  const subject = (parsed.subject ?? "").slice(0, 500);
  if (sender.parser !== "linkedin") {
    await db.insert(errorsT).values({ userId, messageId: messageId ?? "(none)", reason: "Unsupported format — no reader for this sender yet", rawExcerpt: subject });
    await log({ ...base, status: "unsupported", reason: "No reader for this sender" });
    return { code: 250, message: "Accepted" };
  }

  const html = typeof parsed.html === "string" ? parsed.html : "";
  const drafts = parseLinkedInAlert(html);
  if (drafts.length === 0) {
    await db.insert(errorsT).values({ userId, messageId: messageId ?? "(none)", reason: "No job cards parsed from alert", rawExcerpt: subject });
    await log({ ...base, status: "unsupported", reason: "No job cards found" });
    return { code: 250, message: "Accepted" };
  }

  const r = await ingestAlertDrafts(userId, drafts, messageId ?? `fwd:${Date.now()}`);
  const parts = [`${r.inserted} new`];
  if (r.renewed) parts.push(`${r.renewed} renewed`);
  await log({ ...base, status: "accepted", reason: `${drafts.length} jobs · ${parts.join(", ")}`, leadsCreated: r.inserted });
  return { code: 250, message: "Accepted" };
}
