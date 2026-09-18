import "server-only";

// Server-side read layer — the DB-backed replacement for the getters in
// lib/mock-data.ts. Returns the whole workspace for a user in the exact shapes
// lib/types.ts defines, so the existing UI/store can consume it unchanged.
//
// Dates are serialized to "YYYY-MM-DD" strings (matching the old mock data and
// keeping the payload serializable across the server→client boundary).

import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contacts as contactsT,
  gmailConfig as gmailConfigT,
  jobLeadDetails as detailsT,
  jobLeads as leadsT,
  outreachMessages as outreachT,
  reminders as remindersT,
  resumes as resumesT,
  tasks as tasksT,
  user as userT,
  userSettings as settingsT,
} from "@/db/schema";
import type {
  Contact,
  GoogleConnection,
  JobLead,
  JobLeadDetail,
  OutreachMessage,
  Profile,
  Reminder,
  Resume,
  Task,
} from "@/lib/types";

/** Date/timestamp → "YYYY-MM-DD". */
function ymd(d: Date | string | null): string | null {
  if (d == null) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export interface WorkspaceData {
  leads: JobLead[];
  details: Record<string, JobLeadDetail>;
  contacts: Contact[];
  outreach: OutreachMessage[];
  reminders: Reminder[];
  tasks: Task[];
  resumes: Resume[];
  defaultResumeId: string | null;
  reminderIntervalDays: number;
  staleLeadDays: number;
  profile: Profile;
  google: GoogleConnection;
}

/** Everything the dashboard needs for one user, in UI-ready shapes. */
export async function loadWorkspace(userId: string): Promise<WorkspaceData> {
  const [
    leadRows,
    detailRows,
    contactRows,
    outreachRows,
    reminderRows,
    taskRows,
    resumeRows,
    settingsRow,
    gmailRow,
    userRow,
  ] = await Promise.all([
    db.select().from(leadsT).where(eq(leadsT.userId, userId)),
    db
      .select()
      .from(detailsT)
      .innerJoin(leadsT, eq(detailsT.leadId, leadsT.id))
      .where(eq(leadsT.userId, userId)),
    db
      .select()
      .from(contactsT)
      .where(eq(contactsT.userId, userId))
      .orderBy(desc(contactsT.addedAt)),
    db
      .select()
      .from(outreachT)
      .where(eq(outreachT.userId, userId))
      .orderBy(desc(outreachT.createdAt)),
    db.select().from(remindersT).where(eq(remindersT.userId, userId)),
    db.select().from(tasksT).where(eq(tasksT.userId, userId)),
    db
      .select()
      .from(resumesT)
      .where(eq(resumesT.userId, userId))
      .orderBy(asc(resumesT.createdAt)),
    db.select().from(settingsT).where(eq(settingsT.userId, userId)).limit(1),
    db.select().from(gmailConfigT).where(eq(gmailConfigT.userId, userId)).limit(1),
    db.select().from(userT).where(eq(userT.id, userId)).limit(1),
  ]);

  // Per-lead derived fields (contactCount, hasDueReminder) — computed in JS
  // since we already hold every row.
  const contactCountByLead = new Map<string, number>();
  for (const c of contactRows)
    contactCountByLead.set(c.leadId, (contactCountByLead.get(c.leadId) ?? 0) + 1);
  const dueByLead = new Set(
    reminderRows.filter((r) => r.outcome === "pending").map((r) => r.leadId),
  );

  const leads: JobLead[] = leadRows.map((l) => ({
    id: l.id,
    title: l.title,
    company: l.company,
    location: l.location,
    remote: l.remote,
    tags: l.tags,
    postedRelative: l.postedRelative,
    canonicalJobUrl: l.canonicalJobUrl,
    linkedinJobId: l.linkedinJobId,
    status: l.status,
    closeOutcome: l.closeOutcome,
    capturedAt: ymd(l.capturedAt)!,
    contactCount: contactCountByLead.get(l.id) ?? 0,
    hasDueReminder: dueByLead.has(l.id),
  }));

  const details: Record<string, JobLeadDetail> = {};
  for (const row of detailRows) {
    const d = row.job_lead_details;
    details[d.leadId] = {
      leadId: d.leadId,
      jdText: d.jdText,
      aiSummary: d.aiSummary,
      notes: d.notes,
    };
  }

  const contacts: Contact[] = contactRows.map((c) => ({
    id: c.id,
    leadId: c.leadId,
    name: c.name,
    title: c.title,
    linkedinUrl: c.linkedinUrl,
    connectionType: c.connectionType,
    aiParsed: c.aiParsed,
    addedAt: ymd(c.addedAt)!,
  }));

  const outreach: OutreachMessage[] = outreachRows.map((m) => ({
    id: m.id,
    leadId: m.leadId,
    contactId: m.contactId,
    kind: m.kind,
    channel: m.channel,
    status: m.status,
    draftBody: m.draftBody,
    sentBody: m.sentBody,
    resumeId: m.resumeId,
    createdAt: ymd(m.createdAt)!,
    sentAt: ymd(m.sentAt),
  }));

  const reminders: Reminder[] = reminderRows.map((r) => ({
    id: r.id,
    outreachMessageId: r.outreachMessageId,
    leadId: r.leadId,
    sequence: r.sequence,
    dueDate: r.dueDate,
    outcome: r.outcome,
    label: r.label ?? undefined,
    manual: r.manual,
  }));

  const tasks: Task[] = taskRows.map((t) => ({
    id: t.id,
    jobId: t.jobId,
    reminderId: t.reminderId,
    title: t.title,
    kind: t.kind,
    dueDate: t.dueDate,
    status: t.status,
    createdAt: ymd(t.createdAt)!,
    completedAt: ymd(t.completedAt),
  }));

  const resumes: Resume[] = resumeRows.map((r) => ({
    id: r.id,
    label: r.label,
    fileName: r.fileName,
    fileType: r.fileType,
    sizeKb: r.sizeKb,
    updatedAt: ymd(r.updatedAt)!,
    isDefault: r.isDefault,
  }));

  const settings = settingsRow[0];
  const gmail = gmailRow[0];
  const u = userRow[0];

  const profile: Profile = {
    name: u?.name ?? "",
    email: u?.email ?? "",
    mobile: u?.mobile ?? "",
  };

  const google: GoogleConnection = {
    connected: gmail?.connected ?? false,
    email: gmail?.connected ? (u?.email ?? null) : null,
    scope: "gmail.readonly",
  };

  return {
    leads,
    details,
    contacts,
    outreach,
    reminders,
    tasks,
    resumes,
    defaultResumeId: settings?.defaultResumeId ?? resumes.find((r) => r.isDefault)?.id ?? null,
    reminderIntervalDays: settings?.reminderIntervalDays ?? 3,
    staleLeadDays: settings?.staleLeadDays ?? 14,
    profile,
    google,
  };
}
