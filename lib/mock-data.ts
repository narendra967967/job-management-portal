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

export const mockLeads: JobLead[] = [
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
];

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
