// Sent-email log (admin Monitoring → Sent emails): one row per email the app
// sends, whichever channel sent it. Client-safe shapes and labels. Approved in
// docs/admin-dashboard/spec.md ("New data"): no email content is kept, rows
// are kept 30 days under Settings → Data retention. The table and the
// recording at lib/mailer.ts sendMailWith arrive in dashboard phase 4; until
// then the page shows lib/admin/sent-emails-sample.ts.

export type SentEmailStatus = "sent" | "failed";

/** What kind of email: an automatic one (Email templates), a broadcast, or a settings test. */
export type SentEmailKind = "template" | "broadcast" | "test";

export const SENT_EMAIL_KIND_LABELS: Record<SentEmailKind, string> = {
  template: "Automatic email",
  broadcast: "Broadcast",
  test: "Test email",
};

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

/** Default number of days kept (Settings → Data retention can change it). */
export const SENT_EMAIL_KEEP_DAYS = 30;
