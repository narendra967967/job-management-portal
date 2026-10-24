// Data retention — what log-like data is kept and for how long (admin
// Settings → Data retention). Client-safe: labels, limits and defaults shared by
// the settings form, its validation and the purge job (lib/retention.ts).

export type RetentionKey =
  | "inboundLogDays"
  | "ingestIssueDays"
  | "processedLedgerDays"
  | "leadPurgeLogDays"
  | "notificationDays";

export type RetentionConfig = Record<RetentionKey, number>;

export interface RetentionType {
  key: RetentionKey;
  label: string;
  hint: string;
  min: number;
  max: number;
  default: number;
}

export const RETENTION_TYPES: RetentionType[] = [
  {
    key: "inboundLogDays",
    label: "Inbound email log",
    hint: "Admin log of forwarded emails (metadata only)",
    min: 1,
    max: 365,
    default: 30,
  },
  {
    key: "ingestIssueDays",
    label: "Ingestion issues",
    hint: "Users' “couldn't read this email” list",
    min: 7,
    max: 365,
    default: 30,
  },
  {
    key: "processedLedgerDays",
    label: "Processed-email ledger",
    hint: "Stops one email being read twice · at least 60 days, so re-sent alerts aren't read again",
    min: 60,
    max: 730,
    default: 180,
  },
  {
    key: "leadPurgeLogDays",
    label: "Lead purge history",
    hint: "Record of leads removed by Lead retention",
    min: 30,
    max: 1095,
    default: 365,
  },
  {
    key: "notificationDays",
    label: "Notifications",
    hint: "The bell's notifications, read or not",
    min: 7,
    max: 365,
    default: 90,
  },
];

export const RETENTION_DEFAULTS = Object.fromEntries(
  RETENTION_TYPES.map((t) => [t.key, t.default]),
) as RetentionConfig;
