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
  account as accountT,
  contacts as contactsT,
  gmailConfig as gmailConfigT,
  gmailIngestErrors as errorsT,
  gmailSyncState as syncStateT,
  jobLeadDetails as detailsT,
  jobLeads as leadsT,
  outreachMessages as outreachT,
  reminders as remindersT,
  resumes as resumesT,
  tasks as tasksT,
  user as userT,
  userSettings as settingsT,
} from "@/db/schema";
import { OUTREACH_KIND_LABELS } from "@/lib/types";
import type {
  AiSettings,
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

export interface GmailConfigData {
  senders: string[];
  label: string;
  subjectKeywords: string;
  lookbackDays: number;
  connected: boolean;
}

export interface GmailSyncStatus {
  lastSyncedAt: string | null; // ISO
  lastRunAt: string | null; // ISO
  lastError: string | null;
}

export interface IngestError {
  id: string;
  messageId: string;
  reason: string;
  rawExcerpt: string | null;
  createdAt: string; // ISO
}

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
  aiSettings: AiSettings;
  gmailConfig: GmailConfigData;
  syncIntervalHours: number;
  gmailSync: GmailSyncStatus;
  ingestErrors: IngestError[];
  aiPrompts: { summary: string; draft: string };
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
    googleAccountRows,
    syncStateRows,
    errorRows,
  ] = await Promise.all([
    db.select().from(leadsT).where(eq(leadsT.userId, userId)),
    db.select().from(detailsT).where(eq(detailsT.userId, userId)),
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
    db
      .select({ accountId: accountT.accountId })
      .from(accountT)
      .where(and(eq(accountT.userId, userId), eq(accountT.providerId, "google")))
      .limit(1),
    db.select().from(syncStateT).where(eq(syncStateT.userId, userId)).limit(1),
    db
      .select()
      .from(errorsT)
      .where(eq(errorsT.userId, userId))
      .orderBy(desc(errorsT.createdAt))
      .limit(20),
  ]);

  // Per-lead derived fields (contactCount, hasDueReminder) — computed in JS
  // since we already hold every row.
  const contactCountByLead = new Map<string, number>();
  for (const c of contactRows)
    contactCountByLead.set(c.leadId, (contactCountByLead.get(c.leadId) ?? 0) + 1);
  const dueByLead = new Set(
    reminderRows.filter((r) => r.outcome === "pending").map((r) => r.leadId),
  );
  const jdByLead = new Set(
    detailRows.filter((d) => d.jdText && d.jdText.trim()).map((d) => d.leadId),
  );
  const outreachByLead = new Set(outreachRows.map((m) => m.leadId));

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
    hasJd: jdByLead.has(l.id),
    hasOutreach: outreachByLead.has(l.id),
  }));

  const details: Record<string, JobLeadDetail> = {};
  for (const d of detailRows) {
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

  // Lookups for explaining why each reminder exists.
  const outreachById = new Map(outreachRows.map((m) => [m.id, m]));
  const contactById = new Map(contactRows.map((c) => [c.id, c]));
  const reminderReason = (r: (typeof reminderRows)[number]): string | undefined => {
    if (r.manual) return r.label ?? undefined;
    if (r.outreachMessageId) {
      const m = outreachById.get(r.outreachMessageId);
      if (m) {
        const kind = OUTREACH_KIND_LABELS[m.kind].toLowerCase();
        const c = m.contactId ? contactById.get(m.contactId) : undefined;
        return c
          ? `Follow-up on your ${kind} to ${c.name}`
          : `Follow-up on your ${kind}`;
      }
    }
    return undefined;
  };

  const reminders: Reminder[] = reminderRows.map((r) => ({
    id: r.id,
    outreachMessageId: r.outreachMessageId,
    leadId: r.leadId,
    sequence: r.sequence,
    dueDate: r.dueDate,
    outcome: r.outcome,
    label: r.label ?? undefined,
    manual: r.manual,
    reason: reminderReason(r),
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

  // "Connected" means a Google account is linked for this user (its refresh
  // token powers the Gmail sync). Login is separate (email+password).
  const googleLinked = googleAccountRows.length > 0;
  const google: GoogleConnection = {
    connected: googleLinked,
    email: googleLinked ? (u?.email ?? null) : null,
    scope: "gmail.readonly",
    configured:
      !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
  };

  const aiSettings: AiSettings = {
    provider: settings?.aiProvider ?? "openai",
    model: settings?.aiModel ?? "",
    keyConfigured: !!settings?.aiKeyCiphertext,
    keyLast4: settings?.aiKeyLast4 ?? null,
  };

  const gmailConfig: GmailConfigData = {
    senders: gmail?.senders ?? [],
    label: gmail?.label ?? "",
    subjectKeywords: gmail?.subjectKeywords ?? "",
    lookbackDays: gmail?.lookbackDays ?? 30,
    connected: gmail?.connected ?? false,
  };

  const ss = syncStateRows[0];
  const gmailSync: GmailSyncStatus = {
    lastSyncedAt: ss?.lastSyncedAt ? ss.lastSyncedAt.toISOString() : null,
    lastRunAt: ss?.lastRunAt ? ss.lastRunAt.toISOString() : null,
    lastError: ss?.lastError ?? null,
  };

  const ingestErrors: IngestError[] = errorRows.map((e) => ({
    id: e.id,
    messageId: e.messageId,
    reason: e.reason,
    rawExcerpt: e.rawExcerpt,
    createdAt: e.createdAt.toISOString(),
  }));

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
    aiSettings,
    gmailConfig,
    syncIntervalHours: settings?.syncIntervalHours ?? 24,
    gmailSync,
    ingestErrors,
    aiPrompts: {
      summary: settings?.promptSummary ?? "",
      draft: settings?.promptDraft ?? "",
    },
  };
}
