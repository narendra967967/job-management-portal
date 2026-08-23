// Mock data for Phase 1. Everything the UI shows is sourced from here so the
// screens are fully navigable before any real data/schema exists. Phase 3
// replaces these reads with Server Actions.

import type {
  AiSettings,
  AppNotification,
  Contact,
  GoogleConnection,
  JobLead,
  JobLeadDetail,
  OutreachMessage,
  Profile,
  Reminder,
  Resume,
} from "@/lib/types";

// LinkedIn's numeric job ID from a canonical job URL — the dedupe key.
export function extractLinkedInJobId(url: string): string {
  const m =
    url.match(/\/jobs\/view\/(\d+)/) ??
    url.match(/(?:currentJobId|jobId)=(\d+)/);
  return m ? m[1] : "";
}

const rawLeads: Omit<JobLead, "linkedinJobId">[] = [
  {
    id: "lead-1",
    title: "Delivery Manager — Remote",
    company: "Optum",
    location: "Eden Prairie, MN",
    remote: true,
    tags: ["Actively recruiting"],
    postedRelative: "3 days ago",
    canonicalJobUrl: "https://www.linkedin.com/jobs/view/3901234567",
    status: "new",
    capturedAt: "2026-08-16",
    contactCount: 0,
    hasDueReminder: false,
  },
  {
    id: "lead-2",
    title: "Senior Product Manager",
    company: "Stripe",
    location: "Remote (US)",
    remote: true,
    tags: ["Actively recruiting", "Early applicant"],
    postedRelative: "1 day ago",
    canonicalJobUrl: "https://www.linkedin.com/jobs/view/3901234222",
    status: "reviewing",
    capturedAt: "2026-08-18",
    contactCount: 2,
    hasDueReminder: false,
  },
  {
    id: "lead-3",
    title: "Engineering Lead, Platform",
    company: "Datadog",
    location: "New York, NY",
    remote: false,
    tags: ["Actively recruiting"],
    postedRelative: "5 days ago",
    canonicalJobUrl: "https://www.linkedin.com/jobs/view/3901230000",
    status: "applied",
    capturedAt: "2026-08-14",
    contactCount: 1,
    hasDueReminder: true,
  },
  {
    id: "lead-4",
    title: "Group Product Manager, Payments",
    company: "Adyen",
    location: "Remote (EU)",
    remote: true,
    tags: [],
    postedRelative: "6 days ago",
    canonicalJobUrl: "https://www.linkedin.com/jobs/view/3901111111",
    status: "reviewing",
    capturedAt: "2026-08-13",
    contactCount: 0,
    hasDueReminder: false,
  },
  {
    id: "lead-5",
    title: "Director of Program Management",
    company: "Coinbase",
    location: "Remote (US)",
    remote: true,
    tags: ["Actively recruiting"],
    postedRelative: "2 days ago",
    canonicalJobUrl: "https://www.linkedin.com/jobs/view/3901222333",
    status: "new",
    capturedAt: "2026-08-17",
    contactCount: 0,
    hasDueReminder: false,
  },
  {
    id: "lead-6",
    title: "Technical Program Manager",
    company: "Cloudflare",
    location: "Austin, TX",
    remote: false,
    tags: [],
    postedRelative: "8 days ago",
    canonicalJobUrl: "https://www.linkedin.com/jobs/view/3900999888",
    status: "discarded",
    capturedAt: "2026-08-11",
    contactCount: 0,
    hasDueReminder: false,
  },
  {
    id: "lead-7",
    title: "Principal Product Manager, Growth",
    company: "Notion",
    location: "Remote (US)",
    remote: true,
    tags: ["Actively recruiting"],
    postedRelative: "4 days ago",
    canonicalJobUrl: "https://www.linkedin.com/jobs/view/3902001001",
    status: "new",
    capturedAt: "2026-08-15",
    contactCount: 0,
    hasDueReminder: false,
  },
  {
    id: "lead-8",
    title: "Senior Engineering Manager",
    company: "Figma",
    location: "San Francisco, CA",
    remote: false,
    tags: ["Early applicant"],
    postedRelative: "7 days ago",
    canonicalJobUrl: "https://www.linkedin.com/jobs/view/3902001002",
    status: "reviewing",
    capturedAt: "2026-08-12",
    contactCount: 0,
    hasDueReminder: false,
  },
  {
    id: "lead-9",
    title: "Product Lead, Payments",
    company: "Block",
    location: "Remote (US)",
    remote: true,
    tags: ["Actively recruiting"],
    postedRelative: "9 days ago",
    canonicalJobUrl: "https://www.linkedin.com/jobs/view/3902001003",
    status: "applied",
    capturedAt: "2026-08-10",
    contactCount: 0,
    hasDueReminder: false,
  },
  {
    id: "lead-10",
    title: "Director of Engineering",
    company: "Ramp",
    location: "New York, NY",
    remote: false,
    tags: [],
    postedRelative: "10 days ago",
    canonicalJobUrl: "https://www.linkedin.com/jobs/view/3902001004",
    status: "new",
    capturedAt: "2026-08-09",
    contactCount: 0,
    hasDueReminder: false,
  },
  {
    id: "lead-11",
    title: "Staff Technical Program Manager",
    company: "Airbnb",
    location: "Remote (US)",
    remote: true,
    tags: ["Actively recruiting"],
    postedRelative: "11 days ago",
    canonicalJobUrl: "https://www.linkedin.com/jobs/view/3902001005",
    status: "reviewing",
    capturedAt: "2026-08-08",
    contactCount: 0,
    hasDueReminder: false,
  },
  {
    id: "lead-12",
    title: "Head of Product Operations",
    company: "Linear",
    location: "Remote (Global)",
    remote: true,
    tags: ["Early applicant"],
    postedRelative: "12 days ago",
    canonicalJobUrl: "https://www.linkedin.com/jobs/view/3902001006",
    status: "new",
    capturedAt: "2026-08-07",
    contactCount: 0,
    hasDueReminder: false,
  },
  {
    id: "lead-13",
    title: "Engineering Manager, Infrastructure",
    company: "Vercel",
    location: "Remote (US)",
    remote: true,
    tags: [],
    postedRelative: "13 days ago",
    canonicalJobUrl: "https://www.linkedin.com/jobs/view/3902001007",
    status: "discarded",
    capturedAt: "2026-08-06",
    contactCount: 0,
    hasDueReminder: false,
  },
  {
    id: "lead-14",
    title: "Group Product Manager, Enterprise",
    company: "Atlassian",
    location: "Austin, TX",
    remote: false,
    tags: ["Actively recruiting"],
    postedRelative: "14 days ago",
    canonicalJobUrl: "https://www.linkedin.com/jobs/view/3902001008",
    status: "reviewing",
    capturedAt: "2026-08-05",
    contactCount: 0,
    hasDueReminder: false,
  },
  {
    id: "lead-15",
    title: "Senior Product Manager, AI",
    company: "OpenAI",
    location: "San Francisco, CA",
    remote: false,
    tags: ["Actively recruiting", "Early applicant"],
    postedRelative: "15 days ago",
    canonicalJobUrl: "https://www.linkedin.com/jobs/view/3902001009",
    status: "applied",
    capturedAt: "2026-08-04",
    contactCount: 0,
    hasDueReminder: false,
  },
  {
    id: "lead-16",
    title: "Principal Engineer, Platform",
    company: "Snowflake",
    location: "Remote (US)",
    remote: true,
    tags: [],
    postedRelative: "16 days ago",
    canonicalJobUrl: "https://www.linkedin.com/jobs/view/3902001010",
    status: "new",
    capturedAt: "2026-08-03",
    contactCount: 0,
    hasDueReminder: false,
  },
  {
    id: "lead-17",
    title: "VP of Product",
    company: "Retool",
    location: "Remote (US)",
    remote: true,
    tags: ["Early applicant"],
    postedRelative: "17 days ago",
    canonicalJobUrl: "https://www.linkedin.com/jobs/view/3902001011",
    status: "reviewing",
    capturedAt: "2026-08-02",
    contactCount: 0,
    hasDueReminder: false,
  },
  {
    id: "lead-18",
    title: "Technical Program Manager, Security",
    company: "Okta",
    location: "Seattle, WA",
    remote: false,
    tags: [],
    postedRelative: "18 days ago",
    canonicalJobUrl: "https://www.linkedin.com/jobs/view/3902001012",
    status: "discarded",
    capturedAt: "2026-08-01",
    contactCount: 0,
    hasDueReminder: false,
  },
  {
    id: "lead-19",
    title: "Senior Program Manager, Fintech",
    company: "Plaid",
    location: "Remote (US)",
    remote: true,
    tags: ["Actively recruiting"],
    postedRelative: "19 days ago",
    canonicalJobUrl: "https://www.linkedin.com/jobs/view/3902001013",
    status: "new",
    capturedAt: "2026-07-31",
    contactCount: 0,
    hasDueReminder: false,
  },
];

// The dedupe key (linkedinJobId) is derived from each lead's canonical URL,
// mirroring how the Phase-3 Gmail sync will populate it.
export const mockLeads: JobLead[] = rawLeads.map((l) => ({
  ...l,
  linkedinJobId: extractLinkedInJobId(l.canonicalJobUrl),
}));

export const mockLeadDetails: Record<string, JobLeadDetail> = {
  "lead-2": {
    leadId: "lead-2",
    jdText:
      "Stripe is looking for a Senior Product Manager to own the payments acceptance experience. You'll partner with engineering, design, and data science to ship reliable, high-scale products used by millions of businesses...",
    aiSummary:
      "Senior PM role owning payments acceptance at Stripe. Emphasis on high-scale reliability, cross-functional leadership, and data-informed decisions. Remote (US).",
    notes: "Referral from Priya could help — she moved to Stripe last year.",
  },
  "lead-3": {
    leadId: "lead-3",
    jdText:
      "Datadog seeks an Engineering Lead for the Platform team to guide a group of senior engineers building the observability data pipeline...",
    aiSummary:
      "Engineering leadership over Datadog's core platform/observability pipeline. On-site NYC. Strong distributed-systems background expected.",
    notes: null,
  },
};

export const mockContacts: Contact[] = [
  {
    id: "contact-1",
    leadId: "lead-2",
    name: "Priya Nair",
    title: "Staff Product Manager",
    linkedinUrl: "https://www.linkedin.com/in/priya-nair",
    connectionType: "referral",
    aiParsed: true,
  },
  {
    id: "contact-2",
    leadId: "lead-2",
    name: "Marcus Webb",
    title: "Technical Recruiter",
    linkedinUrl: "https://www.linkedin.com/in/marcus-webb",
    connectionType: "recruiter",
    aiParsed: true,
  },
  {
    id: "contact-3",
    leadId: "lead-3",
    name: "Dana Ortiz",
    title: "Engineering Manager",
    linkedinUrl: "https://www.linkedin.com/in/dana-ortiz",
    connectionType: "hiring-manager",
    aiParsed: false,
  },
];

export const mockOutreach: OutreachMessage[] = [
  {
    id: "msg-1",
    leadId: "lead-3",
    contactId: "contact-3",
    kind: "cold-outreach",
    channel: "LinkedIn",
    status: "sent",
    draftBody:
      "Hi Dana, I saw the Engineering Lead role on the Platform team and was excited...",
    sentBody:
      "Hi Dana, I saw the Engineering Lead, Platform role and wanted to reach out directly. My background is in scaling observability pipelines, and I'd love a few minutes to learn what success looks like for this team.",
    resumeId: "resume-1",
    createdAt: "2026-08-15",
    sentAt: "2026-08-15",
  },
];

export const mockReminders: Reminder[] = [
  {
    id: "rem-1",
    outreachMessageId: "msg-1",
    leadId: "lead-3",
    sequence: 1,
    dueDate: "2026-08-18",
    outcome: "pending",
    manual: false,
  },
];

export const mockResumes: Resume[] = [
  {
    id: "resume-1",
    label: "PM — Payments focus",
    fileName: "Gupta_PM_Payments.pdf",
    fileType: "pdf",
    sizeKb: 212,
    updatedAt: "2026-08-01",
    isDefault: true,
  },
  {
    id: "resume-2",
    label: "Eng Leadership",
    fileName: "Gupta_Eng_Leadership.pdf",
    fileType: "pdf",
    sizeKb: 188,
    updatedAt: "2026-07-20",
  },
  {
    id: "resume-3",
    label: "General / Program Mgmt",
    fileName: "Gupta_Program_Mgmt.docx",
    fileType: "docx",
    sizeKb: 96,
    updatedAt: "2026-06-30",
  },
];

export const mockProfile: Profile = {
  name: "Narendra Gupta",
  email: "narendra@example.com",
  mobile: "+1 (555) 018-2245",
};

// Default state for the Settings → Google integration. Read-only always.
export const mockGoogleConnection: GoogleConnection = {
  connected: false,
  email: null,
  scope: "gmail.readonly",
};

// Default state for the Settings → AI provider section. No key set by default.
export const mockAiSettings: AiSettings = {
  provider: "openai",
  model: "",
  keyConfigured: false,
  keyLast4: null,
};

// Notifications shown in the top-bar bell. Each links to a lead.
export const mockNotifications: AppNotification[] = [
  {
    id: "n-1",
    kind: "reminder-due",
    title: "Follow-up due",
    detail: "Engineering Lead, Platform · Datadog",
    leadId: "lead-3",
    time: "today",
    unread: true,
  },
  {
    id: "n-2",
    kind: "new-lead",
    title: "New lead captured",
    detail: "Director of Program Management · Coinbase",
    leadId: "lead-5",
    time: "2d",
    unread: true,
  },
  {
    id: "n-3",
    kind: "new-lead",
    title: "New lead captured",
    detail: "Delivery Manager · Optum",
    leadId: "lead-1",
    time: "3d",
    unread: true,
  },
];

// ---- Lookup helpers (mock stand-ins for Phase 3 queries) ----

/** Seeded default resume (used for a lead's fit score unless overridden). */
export function getDefaultResumeId(): string {
  return (mockResumes.find((r) => r.isDefault) ?? mockResumes[0])?.id ?? "";
}

export function getLead(id: string): JobLead | undefined {
  return mockLeads.find((l) => l.id === id);
}

export function getLeadDetail(id: string): JobLeadDetail | undefined {
  return mockLeadDetails[id];
}

export function getContactsForLead(leadId: string): Contact[] {
  return mockContacts.filter((c) => c.leadId === leadId);
}

export function getOutreachForLead(leadId: string): OutreachMessage[] {
  return mockOutreach.filter((m) => m.leadId === leadId);
}

export function getRemindersForLead(leadId: string): Reminder[] {
  return mockReminders.filter((r) => r.leadId === leadId);
}

export function getAllDueReminders(): Reminder[] {
  return mockReminders.filter((r) => r.outcome === "pending");
}
