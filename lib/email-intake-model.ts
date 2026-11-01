// Email intake — shared types, labels and pure helpers (client-safe).
// Used by both the user side (Settings → Email forwarding) and the admin side
// (Email intake settings, Forwarding health, Inbound email log). See
// docs/email-forwarding.md for the full spec.

import { sourceFromUrl } from "@/lib/lead-source";
import { LEAD_SOURCE_LABELS } from "@/lib/types";

/** Admin switches + limits (single-row config). */
export interface EmailIntakeConfig {
  /** Email forwarding (the main intake). */
  forwardingEnabled: boolean;
  /** "Connect Gmail" (Google OAuth, gmail.readonly) and everything tied to it. */
  gmailOAuthEnabled: boolean;
  /** Largest accepted email, in bytes. */
  maxBytes: number;
  /** Most jobs the AI reader may take from one email. */
  aiMaxJobs: number;
  /** Domain users forward to — set per environment, read-only in the UI. */
  receivingDomain: string;
  gmailToggledAt: string | null;
  gmailToggledBy: string | null;
}

export const MAX_BYTES_MIN = 256 * 1024;
export const MAX_BYTES_MAX = 10 * 1024 * 1024;

export type InboundParser = "linkedin" | "naukri" | "timesjobs" | "glassdoor" | "theladders" | "none";

/** Reader choices, in dropdown order (lib/alert-parsers.ts has the code). */
export const PARSER_LABELS: Record<InboundParser, string> = {
  linkedin: "LinkedIn job alerts",
  naukri: "Naukri job alerts",
  timesjobs: "TimesJobs job alerts",
  glassdoor: "Glassdoor job emails",
  theladders: "TheLadders job alerts",
  none: "None (logged as unsupported)",
};

export const INBOUND_PARSERS = Object.keys(PARSER_LABELS) as InboundParser[];

/** One allowed sender: who may send, which DKIM domain must sign, how to read it. */
export interface InboundSender {
  id: string;
  /** Exact address (`jobalerts-noreply@linkedin.com`) or a whole domain (`*@naukri.com`). */
  match: string;
  /** DKIM `d=` domain that must sign the email (e.g. `linkedin.com`). */
  signingDomain: string;
  parser: InboundParser;
  enabled: boolean;
}

export type InboundStatus = "accepted" | "rejected" | "unsupported" | "duplicate" | "gmail_code" | "queued";

export const INBOUND_STATUS_LABELS: Record<InboundStatus, string> = {
  accepted: "Accepted",
  rejected: "Rejected",
  unsupported: "Unsupported format",
  duplicate: "Duplicate",
  gmail_code: "Gmail confirmation",
  queued: "Reading with AI",
};

/** One row of the user-side Email log — no admin-only technical detail. */
export interface MyEmailLogRow {
  id: string;
  receivedAt: string;
  /** Job site name ("LinkedIn"), or "—". */
  site: string;
  /** Full sender for accepted job-site mail, else just the sender's domain. */
  sender: string;
  status: InboundStatus;
  reason: string;
  leadsCreated: number;
  /** What the user can do about it, if anything. */
  fix: EmailLogFix | null;
}

export type EmailLogFix = "request-site" | "add-ai-key" | "check-ai-key" | "upgrade-plan" | "forward-again";

/** The one step that would get a blocked email through. Rejected senders need
 *  us to add the site. Emails no built-in reader could read need AI, which takes
 *  a plan that includes it and the user's own key (checked as they are now). Once
 *  both are in place the old email still isn't read: it has to come in again. */
export function emailLogFix(
  status: InboundStatus,
  reason: string,
  now: { aiReading: boolean; hasAiKey: boolean },
): EmailLogFix | null {
  if (status === "rejected" && /Sender not allowed|site that isn't allowed/.test(reason)) return "request-site";
  if (status === "unsupported") {
    if (/AI reader (stopped|failed)/.test(reason)) return "check-ai-key";
    // "AI found no jobs" and the like: AI already read it, so none of this helps.
    if (!/No reader for this sender|No job cards found|AI key removed/.test(reason)) return null;
    if (!now.aiReading) return "upgrade-plan";
    if (!now.hasAiKey) return "add-ai-key";
    return "forward-again";
  }
  return null;
}

/** The log's reason in plain words for the user. Drops technical notes in
 *  brackets ("Reading with AI (no reader)") and rewords the terse ones. */
export function userReason(status: InboundStatus, reason: string): string {
  const r = reason.replace(/\s*\([^)]*\)/g, "").trim();
  const plain: Record<string, string> = {
    "Signature check failed": "Couldn't confirm it really came from the job site",
    "Sender not allowed": "We don't accept alerts from this site yet",
    "Hand-forwarded from a site that isn't allowed": "Hand-forwarded from a site we don't accept yet",
    "Forwarding turned off": "Arrived while forwarding was turned off",
    "Too large": "The email was too large",
    "Malformed email": "The email couldn't be read",
    "Already processed": "Already received earlier",
    "Unknown address": "Sent to an address that isn't yours",
    "Empty confirmation email": "Gmail's confirmation email had no link",
    "No reader for this sender": "Jobtiva can't read this site's alerts on its own",
    "No job cards found": "Jobtiva couldn't find any jobs in this email on its own",
  };
  if (status === "gmail_code") return "Gmail forwarding confirmation";
  // The AI reader's failures carry provider details the user can't act on.
  const label = r.startsWith("Hand-forwarded · ") ? "Hand-forwarded · " : "";
  if (/AI reader stopped: provider answered 402/.test(r)) return `${label}Your AI provider is out of credit`;
  if (/AI reader stopped/.test(r)) return `${label}Your AI provider rejected your key`;
  if (/AI reader failed/.test(r)) return `${label}AI couldn't read this email`;
  const parts = r.split(" · ");
  const last = parts[parts.length - 1];
  if (plain[last]) parts[parts.length - 1] = plain[last];
  return parts.join(" · ");
}

/** Sizes offered for the inbound log's pages. */
export const INBOUND_LOG_PAGE_SIZES = [25, 50, 100] as const;

/** A friendly name for a job site's domain: "naukri.com" → "Naukri". */
export function siteLabel(domain: string | null): string {
  if (!domain) return "—";
  const d = domain.toLowerCase();
  if (d === "google.com" || d.endsWith(".google.com")) return "Gmail";
  const source = sourceFromUrl(`https://${d}`);
  return source === "other" ? d : LEAD_SOURCE_LABELS[source];
}

export const AI_MAX_JOBS_MIN = 1;
export const AI_MAX_JOBS_MAX = 100;

/** One row of the inbound email log — metadata only, never content. */
export interface InboundLogEntry {
  id: string;
  receivedAt: string;
  user: { name: string; email: string } | null;
  /** Full sender address — only kept for accepted job-site mail. */
  fromAddress: string | null;
  /** Always kept (the only sender info for rejected mail). */
  fromDomain: string;
  /** The job site's domain (the original sender's, for a hand-forward). */
  site: string | null;
  signingDomain: string | null;
  status: InboundStatus;
  reason: string;
  sizeBytes: number;
  leadsCreated: number;
}

export interface ForwardingHealth {
  last24h: { received: number; accepted: number; rejected: number };
  last7d: { received: number; accepted: number; rejected: number };
  topRejections: { reason: string; count: number }[];
  lastReceivedAt: string | null;
  usersSetUp: number;
  usersTotal: number;
}

/** The signed-in user's forwarding address and its progress. */
export interface MyForwarding {
  address: string;
  /** The user's own switch. Off: mail to the address is dropped, setup is kept. */
  enabled: boolean;
  /** Gmail's forwarding confirmation code (older format), when one has arrived. */
  gmailCode: string | null;
  /** Gmail's confirmation link (current format) — verify link only, never cancel. */
  gmailConfirmUrl: string | null;
  /** The Gmail account that asked to forward to this address. */
  gmailConfirmFrom: string | null;
  /** Gmail's confirmation email as plain text (shown on request until confirmed). */
  gmailConfirmText: string | null;
  gmailCodeAt: string | null;
  confirmedAt: string | null;
  firstReceivedAt: string | null;
  lastReceivedAt: string | null;
}

/** Per-user forwarding status as admins see it. */
export interface UserForwardingStatus {
  /** The user's own switch. */
  enabled: boolean;
  addressCreatedAt: string | null;
  /** Gmail's confirmation (link or code) arrived — setup started in Gmail. */
  gmailCodeAt: string | null;
  confirmedAt: string | null;
  firstReceivedAt: string | null;
  lastReceivedAt: string | null;
}

export type ForwardingStage =
  | "not_started" // address exists, nothing received yet
  | "code_received" // Gmail's confirmation (link or code) arrived, not yet confirmed
  | "waiting_first_alert" // Gmail confirmed, no job alert yet
  | "working"; // at least one alert received

export function forwardingStage(
  f: Pick<MyForwarding, "gmailCode" | "gmailConfirmUrl" | "gmailConfirmText" | "confirmedAt" | "firstReceivedAt">,
): ForwardingStage {
  if (f.firstReceivedAt) return "working";
  if (f.confirmedAt) return "waiting_first_alert";
  if (f.gmailCode || f.gmailConfirmUrl || f.gmailConfirmText) return "code_received";
  return "not_started";
}

export const FORWARDING_STAGE_LABELS: Record<ForwardingStage, string> = {
  not_started: "Not set up",
  code_received: "Confirm in Gmail",
  waiting_first_alert: "Waiting for first alert",
  working: "Working",
};

/** Value for Gmail's filter "From" box, built from the admin's ENABLED
 *  allowed senders: exact addresses as-is, "*@domain" as "@domain" (Gmail
 *  matches any sender on that domain). Empty when nothing is enabled. */
export function gmailFilterFrom(senders: Pick<InboundSender, "match" | "enabled">[]): string {
  const enabled = senders.filter((s) => s.enabled).map((s) => s.match.toLowerCase());
  const wholeSites = enabled.filter((m) => m.startsWith("*@")).map((m) => m.slice(2));
  const parts = enabled
    // An address already covered by a whole-site entry adds nothing.
    .filter((m) => m.startsWith("*@") || !wholeSites.some((d) => domainWithin(m.slice(m.lastIndexOf("@") + 1), d)))
    .map((m) => (m.startsWith("*@") ? m.slice(1) : m));
  return [...new Set(parts)].join(" OR ");
}

/** The sites (domains) those enabled senders belong to, for display. */
export function acceptedSites(senders: Pick<InboundSender, "match" | "enabled">[]): string[] {
  const sites = senders.filter((s) => s.enabled).map((s) => senderMatchDomain(s.match));
  return [...new Set(sites.filter((d): d is string => !!d))].sort();
}

const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const EMAIL_RE = /^[a-z0-9._%+-]+@([a-z0-9.-]+)$/i;

export function isValidDomain(d: string): boolean {
  return DOMAIN_RE.test(d.trim());
}

/** Domain a sender match covers (`x@a.com` → `a.com`, `*@a.com` → `a.com`), or null if malformed. */
export function senderMatchDomain(match: string): string | null {
  const m = match.trim().toLowerCase();
  if (m.startsWith("*@")) return isValidDomain(m.slice(2)) ? m.slice(2) : null;
  const e = EMAIL_RE.exec(m);
  return e && isValidDomain(e[1]) ? e[1] : null;
}

/** True when `domain` is the signing domain or one of its subdomains. */
export function domainWithin(domain: string, signingDomain: string): boolean {
  const d = domain.toLowerCase();
  const s = signingDomain.trim().toLowerCase();
  return d === s || d.endsWith(`.${s}`);
}

/** "just now", "5 min ago", "2 h ago", "3 days ago". Render client-side only (uses the clock). */
export function timeAgo(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(n % (1024 * 1024) === 0 ? 0 : 1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}
