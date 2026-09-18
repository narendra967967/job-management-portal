// Gmail ingestion rules — pure helpers. The live values are held in the
// workspace store (useGmailSettings there) and persisted to gmail_config; this
// file keeps the shared type, sensible defaults, and the query builder the sync
// will use (READ-ONLY, gmail.readonly).

export interface GmailSettings {
  /** From-address allow-list (the sender of your LinkedIn job alerts). */
  senders: string[];
  /** Optional Gmail label to restrict to (if you filter alerts to a label). */
  label: string;
  /** Optional comma-separated words the subject must contain. */
  subjectKeywords: string;
  /** Initial fetch window in days (0 = no limit). Ongoing syncs pull only new. */
  lookbackDays: number;
}

export const DEFAULT_GMAIL_SETTINGS: GmailSettings = {
  senders: [
    "jobalerts-noreply@linkedin.com",
    "jobs-noreply@linkedin.com",
    "jobs-listings@linkedin.com",
  ],
  label: "",
  subjectKeywords: "",
  lookbackDays: 30,
};

/** Build the Gmail search query these settings imply (what the sync runs). */
export function buildGmailQuery(s: GmailSettings): string {
  const parts: string[] = [];

  const senders = s.senders.map((x) => x.trim()).filter(Boolean);
  if (senders.length) {
    parts.push(
      senders.length === 1
        ? `from:${senders[0]}`
        : `{${senders.map((f) => `from:${f}`).join(" ")}}`, // {a b} = OR in Gmail
    );
  }

  if (s.label.trim()) parts.push(`label:${s.label.trim().replace(/\s+/g, "-")}`);

  const kws = s.subjectKeywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (kws.length) {
    parts.push(
      `subject:{${kws.map((k) => (k.includes(" ") ? `"${k}"` : k)).join(" ")}}`,
    );
  }

  if (s.lookbackDays > 0) parts.push(`newer_than:${s.lookbackDays}d`);

  return parts.join(" ") || "in:inbox";
}
