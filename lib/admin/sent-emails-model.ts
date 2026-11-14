// Sent-email log (admin Monitoring → Sent emails): one row per email the app
// sends, whichever channel sent it. Client-safe shapes and labels. Approved in
// docs/admin-dashboard/spec.md ("New data"): no email content is kept, rows
// are kept 30 days under Settings → Data retention. Recorded at lib/mailer.ts
// sendMailWith (lib/sent-email-log.ts), read by lib/admin/sent-emails-data.ts.

export type SentEmailStatus = "sent" | "failed";

/** What kind of email: an automatic one (Email templates), a broadcast, or a settings test. */
export type SentEmailKind = "template" | "broadcast" | "test";

export const SENT_EMAIL_KIND_LABELS: Record<SentEmailKind, string> = {
  template: "Automatic email",
  broadcast: "Broadcast",
  test: "Test email",
};

/** Channel names as stored and shown. Text in the table, so a new one needs no migration. */
export const SENT_EMAIL_CHANNELS = { ses: "Amazon SES", smtp: "SMTP" } as const;

/**
 * Which email a send is, for the log. lib/email.ts sendAppEmail requires it,
 * so a new email can't skip the log.
 */
export interface SentEmailTag {
  kind: SentEmailKind;
  /** The template's name, the broadcast's title or the test's name. */
  label: string;
  templateKey?: string;
  broadcastId?: string;
}

export interface SentEmailRow {
  id: string;
  /** ISO time it was handed to the channel. */
  sentAt: string;
  to: string;
  /** The account the address belongs to, when there is one. */
  userId: string | null;
  userName: string | null;
  kind: SentEmailKind;
  /** Email templates key, for automatic emails. */
  templateKey: string | null;
  broadcastId: string | null;
  /** Human name: the template's name, the broadcast's title, or the test's name. */
  label: string;
  subject: string;
  /** Channel name as stored (text, so a new channel needs no migration), e.g. "Amazon SES", "SMTP". */
  channel: string;
  status: SentEmailStatus;
  /** What the channel said when it failed. Never contains a secret. */
  error: string | null;
  /** The channel's message id, for looking an email up in its console. */
  messageId: string | null;
}
