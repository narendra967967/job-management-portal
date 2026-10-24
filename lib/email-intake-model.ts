// Email intake — shared types, labels and pure helpers (client-safe).
// Used by both the user side (Settings → Email forwarding) and the admin side
// (Email intake settings, Forwarding health, Inbound email log). See
// docs/email-forwarding.md for the full spec.

/** Admin switches + limits (single-row config). */
export interface EmailIntakeConfig {
  /** Email forwarding (the main intake). */
  forwardingEnabled: boolean;
  /** "Connect Gmail" (Google OAuth, gmail.readonly) and everything tied to it. */
  gmailOAuthEnabled: boolean;
  /** Largest accepted email, in bytes. */
  maxBytes: number;
  /** Domain users forward to — set per environment, read-only in the UI. */
  receivingDomain: string;
  gmailToggledAt: string | null;
  gmailToggledBy: string | null;
}

export const MAX_BYTES_MIN = 256 * 1024;
export const MAX_BYTES_MAX = 10 * 1024 * 1024;

export type InboundParser = "linkedin" | "naukri" | "timesjobs" | "none";

/** Reader choices, in dropdown order (lib/alert-parsers.ts has the code). */
export const PARSER_LABELS: Record<InboundParser, string> = {
  linkedin: "LinkedIn job alerts",
  naukri: "Naukri job alerts",
  timesjobs: "TimesJobs job alerts",
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

export type InboundStatus = "accepted" | "rejected" | "unsupported" | "duplicate" | "gmail_code";

export const INBOUND_STATUS_LABELS: Record<InboundStatus, string> = {
  accepted: "Accepted",
  rejected: "Rejected",
  unsupported: "Unsupported format",
  duplicate: "Duplicate",
  gmail_code: "Gmail confirmation",
};

/** One row of the inbound email log — metadata only, never content. */
export interface InboundLogEntry {
  id: string;
  receivedAt: string;
  user: { name: string; email: string } | null;
  /** Full sender address — only kept for accepted job-site mail. */
  fromAddress: string | null;
  /** Always kept (the only sender info for rejected mail). */
  fromDomain: string;
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
