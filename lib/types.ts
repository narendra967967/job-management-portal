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
  outreachMessageId: string;
  leadId: string;
  sequence: number; // 1 = Reminder 1, 2 = Reminder 2, ...
  dueDate: string; // ISO date
  outcome: ReminderOutcome;
}

export interface Resume {
  id: string;
  label: string;
  updatedAt: string;
}
