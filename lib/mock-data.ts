// Remaining mock data for surfaces not yet DB-backed (Milestone A migrated the
// core entities — leads/contacts/outreach/reminders/tasks — to Postgres via
// lib/queries.ts + the client store). What stays here:
//   - resumes (become DB-backed when file upload/blob storage lands)
//   - profile / Google connection / AI settings display (persisted with the
//     Settings Server Actions + auth in Milestones B/C)
// These are read by the Settings page and the resume picker / fit score.

import type {
  AiSettings,
  GoogleConnection,
  Profile,
  Resume,
} from "@/lib/types";

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

/** The default resume's id (used for fit scoring until resumes are DB-backed). */
export function getDefaultResumeId(): string {
  return mockResumes.find((r) => r.isDefault)?.id ?? mockResumes[0]?.id ?? "";
}

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
