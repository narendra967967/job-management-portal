// Domain types for Jobtiva. These describe the shape of the data the Phase 1 UI
// renders against mock data; the Drizzle schema in Phase 2 is written to match
// what these reveal the UI actually needs.

// Pipeline phases: new → shortlisted → applied → interview → offer-received are
// OPEN (actionable); discarded and closed are TERMINAL. A job only
// generates/accepts tasks & reminders while open. An offer stays open (you can
// still negotiate / follow up) until you close it with an outcome.
export type LeadStatus =
  | "new"
  | "shortlisted"
  | "applied"
  | "interview"
  | "offer-received"
  | "discarded"
  | "closed";

export const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "shortlisted",
  "applied",
  "interview",
  "offer-received",
  "discarded",
  "closed",
];

/** Statuses where the job is still being worked. */
export const OPEN_LEAD_STATUSES: LeadStatus[] = [
  "new",
  "shortlisted",
  "applied",
  "interview",
  "offer-received",
];

export function isJobOpen(status: LeadStatus): boolean {
  return OPEN_LEAD_STATUSES.includes(status);
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  shortlisted: "Shortlisted",
  applied: "Applied",
  interview: "Interview",
  "offer-received": "Offer Received",
  discarded: "Discarded",
  closed: "Closed",
};

/**
 * Normalize a status read from somewhere that may predate a rename (browser
 * storage, old links). "reviewing" became "shortlisted"; anything unknown → null.
 */
export function normalizeLeadStatus(raw: unknown): LeadStatus | null {
  if (raw === "reviewing") return "shortlisted";
  return LEAD_STATUSES.includes(raw as LeadStatus) ? (raw as LeadStatus) : null;
}

/** Where a lead was found (the job board / platform). Derived from its URL. */
export type LeadSource =
  | "linkedin"
  | "naukri"
  | "indeed"
  | "glassdoor"
  | "wellfound"
  | "instahyre"
  | "foundit"
  | "other";

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  linkedin: "LinkedIn Jobs",
  naukri: "Naukri",
  indeed: "Indeed",
  glassdoor: "Glassdoor",
  wellfound: "Wellfound",
  instahyre: "Instahyre",
  foundit: "foundit",
  other: "Other",
};

/** How a lead got into the app: synced automatically, or added by hand. */
export type LeadOrigin = "system" | "manual";

export const LEAD_ORIGIN_LABELS: Record<LeadOrigin, string> = {
  system: "Added by system",
  manual: "Added manually",
};

// How a job concluded (set when status === "closed").
export type CloseOutcome = "offer" | "rejected" | "withdrawn" | "no-response";

export const CLOSE_OUTCOME_LABELS: Record<CloseOutcome, string> = {
  offer: "Offer / hired",
  rejected: "Rejected",
  withdrawn: "Withdrew",
  "no-response": "No response",
};

// A To-do item. Always tied to a job; optionally linked to a reminder (when it
// was spawned by a follow-up) — standalone/manual tasks have reminderId null.
export type TaskKind = "follow-up" | "decision" | "manual";

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  "follow-up": "Follow-up",
  decision: "Decision",
  manual: "Task",
};

export interface Task {
  id: string;
  jobId: string; // mandatory — every task belongs to a job
  reminderId: string | null; // optional link to the reminder that spawned it
  title: string;
  kind: TaskKind;
  dueDate: string | null; // ISO date
  status: "open" | "done";
  createdAt: string;
  completedAt: string | null;
}

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
  /**
   * LinkedIn's numeric job ID (from the canonical URL). This is the DEDUPE KEY:
   * Phase 2 puts a UNIQUE (user_id, linkedinJobId) constraint on the table and
   * the Gmail sync inserts ON CONFLICT DO NOTHING, so a job re-seen across
   * emails or daily re-fetches is stored exactly once.
   */
  linkedinJobId: string;
  status: LeadStatus;
  closeOutcome?: CloseOutcome | null; // set when status === "closed"
  /** Platform the job was found on (from its URL). */
  source: LeadSource;
  /** Synced automatically ("system") or added by the user ("manual"). */
  origin: LeadOrigin;
  /** The user starred this job as a Top Choice. */
  topChoice: boolean;
  capturedAt: string; // ISO date
  contactCount: number;
  hasDueReminder: boolean;
  /** A job description has been saved for this lead. */
  hasJd: boolean;
  /** At least one outreach message exists for this lead. */
  hasOutreach: boolean;
}

/**
 * "Ready for action" — an open lead that has both a saved JD and at least one
 * contact, so there's enough to actually work it. Derived, not a stored status.
 */
export function isReadyForAction(lead: JobLead): boolean {
  return (
    isJobOpen(lead.status) &&
    lead.hasJd &&
    lead.contactCount > 0 &&
    // Once you've reached out, it's no longer "ready to action" — it moves to
    // the Outreached view.
    !lead.hasOutreach
  );
}

export interface JobLeadDetail {
  leadId: string;
  jdText: string | null;
  aiSummary: string | null;
  notes: string | null;
  /** Saved AI salary estimate (premium), or null. */
  salaryInsight: SalaryInsight | null;
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
  addedAt: string; // ISO date the contact was captured (drives the lead timeline)
}

/**
 * Identity key that groups a contact across leads (FR-6.1). Contacts are stored
 * per-lead, so the same person on two roles is two rows — we treat them as one
 * "person" by LinkedIn URL when present, else by normalized name. Phase 2 can
 * promote this to a real contacts/lead_contacts split if it proves worth it.
 */
export function contactPersonKey(c: Pick<Contact, "linkedinUrl" | "name">): string {
  const url = c.linkedinUrl?.trim().toLowerCase().replace(/\/+$/, "");
  if (url) return `url:${url}`;
  return `name:${c.name.trim().toLowerCase().replace(/\s+/g, " ")}`;
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
  dueDate: string; // ISO datetime (date + time)
  outcome: ReminderOutcome;
  label?: string; // optional note for manual reminders
  manual: boolean;
  // Human explanation of why this reminder exists (e.g. "Follow-up on your
  // referral ask to Priya Nair"), derived server-side. Undefined when there's
  // nothing to add beyond the sequence.
  reason?: string;
}

export interface Resume {
  id: string;
  label: string; // editable display name
  fileName: string; // original uploaded file name
  fileType: "pdf" | "doc" | "docx";
  sizeKb: number;
  updatedAt: string;
  isDefault?: boolean; // the resume used for a lead's fit score unless overridden
  hasText?: boolean; // whether pasted resume text is stored (drives AI scoring)
}

/** Cached AI fit score for a (lead, resume) pair. */
export interface FitScore {
  score: number; // 0–100
  rationale: string | null;
}

/** Key for the fit-scores map: one score per (lead, resume) pair. */
export function fitScoreKey(leadId: string, resumeId: string): string {
  return `${leadId}::${resumeId}`;
}

// Only PDF and DOCX — these extract to text reliably for AI scoring. (Legacy
// .doc is intentionally excluded.) The DB enum still lists "doc" for historical
// rows, but new uploads are restricted to these.
export const RESUME_ACCEPT = ".pdf,.docx";
export const RESUME_ALLOWED_EXT = ["pdf", "docx"] as const;
export const RESUME_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** The user's current plan, for the plan badge (name + accent colour key). */
export interface PlanSummary {
  name: string;
  accent: string;
}

export interface Profile {
  name: string;
  email: string;
  mobile: string;
  /** Where the user lives ("" = not set) — the salary market for unclear remote jobs. */
  country: string;
  /** The user's assigned plan, or null when none. */
  plan: PlanSummary | null;
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
  connected: boolean; // a Google account is linked for this user
  email: string | null; // the linked Google account's email
  scope: string; // always read-only
  configured: boolean; // Google OAuth client is set up server-side (can connect)
}

export type AiProvider = "openai" | "anthropic" | "openrouter";

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: "OpenAI",
  anthropic: "Claude (Anthropic)",
  openrouter: "OpenRouter",
};

// Suggested default model per provider, shown as a placeholder. OpenRouter
// models are namespaced "vendor/model" slugs (openrouter.ai/models).
export const AI_PROVIDER_DEFAULT_MODEL: Record<AiProvider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-5",
  openrouter: "openai/gpt-4o-mini",
};

// API-key prefix hint per provider (for the Settings placeholder + masked view).
export const AI_PROVIDER_KEY_PREFIX: Record<AiProvider, string> = {
  openai: "sk",
  anthropic: "sk-ant",
  openrouter: "sk-or",
};

export interface AiSettings {
  provider: AiProvider;
  model: string;
  // Write-only on the client: the key itself is never sent back to the browser
  // once saved. We only ever expose whether one is set and its last 4 chars.
  keyConfigured: boolean;
  keyLast4: string | null;
}

/**
 * AI salary-expectation estimate for one job (premium). Generated from the JD,
 * location/country and the user's résumé by the user's own AI key — an
 * estimate from the model's general knowledge, NOT live market data.
 */
export interface SalaryInsight {
  /** ISO 4217 code, e.g. "INR". */
  currency: string;
  /** Annual figures (the norm for salary talk), in `currency` units. */
  low: number;
  typical: number;
  high: number;
  /** What the user could reasonably ask for. */
  suggestedAsk: number;
  /** "Low" / "Medium" / "High" — how much the model trusts its own estimate. */
  confidence: "low" | "medium" | "high";
  summary: string;
  factors: string[];
  tips: string[];
  /** What the estimate was based on (shown to the user). */
  basis: {
    /** Pay market used, e.g. "India", "Europe (EU)". */
    country: string;
    resumeLabel: string | null;
    /**
     * Where the market came from — the job's location, the user's profile
     * country, their mobile dial code, or the India default. ("inferred" /
     * missing only on estimates saved before the app resolved it itself.)
     */
    marketSource?: "location" | "profile" | "mobile" | "default" | "inferred";
  };
  /** ISO timestamp it was generated. */
  generatedAt: string;
}
