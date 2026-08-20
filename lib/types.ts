// Domain types for JMP. These describe the shape of the data the Phase 1 UI
// renders against mock data; the Drizzle schema in Phase 2 is written to match
// what these reveal the UI actually needs.

export type LeadStatus = "new" | "reviewing" | "applied" | "discarded";

export const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "reviewing",
  "applied",
  "discarded",
];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  applied: "Applied",
  discarded: "Discarded",
};

export type ConnectionType = "recruiter" | "referral" | "hiring-manager" | "other";

export const CONNECTION_TYPE_LABELS: Record<ConnectionType, string> = {
  recruiter: "Recruiter",
  referral: "Referral",
  "hiring-manager": "Hiring manager",
  other: "Other",
};

export type OutreachKind = "referral-ask" | "cold-outreach" | "follow-up";

export const OUTREACH_KIND_LABELS: Record<OutreachKind, string> = {
  "referral-ask": "Referral ask",
  "cold-outreach": "Cold outreach",
  "follow-up": "Follow-up",
};

export type OutreachStatus = "draft" | "sent";

export type ReminderOutcome =
  | "pending"
  | "reminder-sent"
  | "response-received"
  | "closed"
  | "not-responded";

export const REMINDER_OUTCOME_LABELS: Record<ReminderOutcome, string> = {
  pending: "Due",
  "reminder-sent": "Reminder sent",
  "response-received": "Response received",
  closed: "Closed",
  "not-responded": "Not responded",
};

export interface JobLead {
  id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  tags: string[];
  postedRelative: string;
  canonicalJobUrl: string;
  status: LeadStatus;
  capturedAt: string; // ISO date
  contactCount: number;
  hasDueReminder: boolean;
}

export interface JobLeadDetail {
  leadId: string;
  jdText: string | null;
  aiSummary: string | null;
  notes: string | null;
}

export interface Contact {
  id: string;
  leadId: string;
  name: string;
  title: string;
  linkedinUrl: string | null;
  connectionType: ConnectionType;
  // true when this record came from AI paste-and-parse (vs. manual entry)
  aiParsed: boolean;
}

export interface OutreachMessage {
  id: string;
  leadId: string;
  contactId: string;
  kind: OutreachKind;
  channel: string;
  status: OutreachStatus;
  draftBody: string;
  sentBody: string | null;
  resumeId: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface Reminder {
  id: string;
  // null when the user adds a reminder manually against a lead (not tied to a
  // specific sent message). Auto-scheduled reminders reference the message.
  outreachMessageId: string | null;
  leadId: string;
  sequence: number; // 1 = Reminder 1, 2 = Reminder 2, ...
  dueDate: string; // ISO date
  outcome: ReminderOutcome;
  label?: string; // optional note for manual reminders
  manual: boolean;
}

export interface Resume {
  id: string;
  label: string; // editable display name
  fileName: string; // original uploaded file name
  fileType: "pdf" | "doc" | "docx";
  sizeKb: number;
  updatedAt: string;
}

export const RESUME_ACCEPT = ".pdf,.doc,.docx";
export const RESUME_ALLOWED_EXT = ["pdf", "doc", "docx"] as const;
export const RESUME_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export interface Profile {
  name: string;
  email: string;
  mobile: string;
}

export type NotificationKind = "new-lead" | "reminder-due";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  leadId: string; // clicking a notification always opens this lead
  time: string; // relative, e.g. "3d"
  unread: boolean;
}

export interface GoogleConnection {
  connected: boolean;
  email: string | null;
  scope: string; // always read-only
}

export type AiProvider = "openai" | "anthropic";

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: "OpenAI",
  anthropic: "Claude (Anthropic)",
};

// Suggested default model per provider, shown as a placeholder.
export const AI_PROVIDER_DEFAULT_MODEL: Record<AiProvider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-5",
};

export interface AiSettings {
  provider: AiProvider;
  model: string;
  // Write-only on the client: the key itself is never sent back to the browser
  // once saved. We only ever expose whether one is set and its last 4 chars.
  keyConfigured: boolean;
  keyLast4: string | null;
}
