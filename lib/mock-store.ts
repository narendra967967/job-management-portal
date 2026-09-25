"use client";

// Client workspace store — now DB-backed (the name is legacy; a rename is a
// later cleanup). It holds the current user's data, hydrated once from the
// server (via WorkspaceProvider using loadWorkspace), and exposes:
//   - selector hooks the UI reads (useLeads, useContactsForLead, useTodos, …)
//   - async mutations that call Server Actions then re-read the workspace so the
//     UI reflects the persisted truth. All jobs↔reminders↔tasks cascade logic
//     lives server-side in actions/data.ts now.
//
// Single-user by design (CLAUDE.md), so a module-level singleton is fine.

import { useSyncExternalStore } from "react";
import {
  addContactAction,
  addReminderManualAction,
  completeTaskAction,
  createLeadAction,
  updateLeadAction,
  deleteContactAction,
  deleteLeadsAction,
  deleteReminderAction,
  getWorkspace,
  markSentAction,
  setLeadStatusAction,
  setReminderOutcomeAction,
  snoozeReminderAction,
  updateContactAction,
} from "@/actions/data";
import {
  clearIngestErrorsAction,
  deleteResumeAction,
  disconnectGoogleAction,
  getResumeFileAction,
  getResumeTextAction,
  uploadResumeAction,
  removeAiKeyAction,
  renameResumeAction,
  saveAiKeyAction,
  setDefaultResumeAction,
  updateAiSettingsAction,
  updateFollowUpsAction,
  updateAiPromptsAction,
  updateGmailConfigAction,
  updateProfileAction,
  updateResumeTextAction,
  updateSyncIntervalAction,
} from "@/actions/settings";
import { syncMyGmailAction } from "@/actions/gmail-sync";
import { saveJdAction, summarizeJdAction, scoreFitAction } from "@/actions/ai";
import { toast } from "@/components/ui/toast";
import type { SyncResult } from "@/lib/gmail-sync";
import type { GmailSyncStatus, IngestError } from "@/lib/queries";
import { contactPersonKey, isJobOpen, fitScoreKey } from "@/lib/types";
import {
  CLOSE_OUTCOME_LABELS,
  LEAD_STATUS_LABELS,
  OUTREACH_KIND_LABELS,
  REMINDER_OUTCOME_LABELS,
} from "@/lib/types";
import type {
  AiProvider,
  AiSettings,
  CloseOutcome,
  ConnectionType,
  Contact,
  FitScore,
  GoogleConnection,
  JobLead,
  JobLeadDetail,
  LeadStatus,
  OutreachKind,
  OutreachMessage,
  Profile,
  Reminder,
  ReminderOutcome,
  Resume,
  Task,
} from "@/lib/types";
import type { GmailConfigData, WorkspaceData } from "@/lib/queries";

export interface AppSettings {
  reminderIntervalDays: number;
  staleLeadDays: number;
}

/* ---------------- state ---------------- */

let leads: JobLead[] = [];
let details: Record<string, JobLeadDetail> = {};
let contacts: Contact[] = [];
let outreach: OutreachMessage[] = [];
let reminders: Reminder[] = [];
let tasks: Task[] = [];
let resumes: Resume[] = [];
let defaultResumeId = "";
let appSettings: AppSettings = { reminderIntervalDays: 3, staleLeadDays: 14 };
let profile: Profile = { name: "", email: "", mobile: "" };
let google: GoogleConnection = {
  connected: false,
  email: null,
  scope: "gmail.readonly",
  configured: false,
};
let aiSettings: AiSettings = { provider: "openai", model: "", keyConfigured: false, keyLast4: null };
let gmailConfig: GmailConfigData = {
  senders: [],
  label: "",
  subjectKeywords: "",
  lookbackDays: 30,
  connected: false,
};
let syncIntervalHours = 24;
let gmailSync: GmailSyncStatus = { lastSyncedAt: null, lastRunAt: null, lastError: null };
let ingestErrors: IngestError[] = [];
let aiPrompts = { summary: "", draft: "", score: "" };
let fitScores: Record<string, FitScore> = {};
let hydrated = false;

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function apply(data: WorkspaceData) {
  leads = data.leads;
  details = data.details;
  contacts = data.contacts;
  outreach = data.outreach;
  reminders = data.reminders;
  tasks = data.tasks;
  resumes = data.resumes;
  defaultResumeId =
    data.defaultResumeId ?? data.resumes.find((r) => r.isDefault)?.id ?? "";
  appSettings = {
    reminderIntervalDays: data.reminderIntervalDays,
    staleLeadDays: data.staleLeadDays,
  };
  profile = data.profile;
  google = data.google;
  aiSettings = data.aiSettings;
  gmailConfig = data.gmailConfig;
  syncIntervalHours = data.syncIntervalHours;
  gmailSync = data.gmailSync;
  ingestErrors = data.ingestErrors;
  aiPrompts = data.aiPrompts;
  fitScores = data.fitScores;
}

/** Called by WorkspaceProvider during render so the first snapshot has data.
 *  On the server we apply fresh per request (single-user, so no real request
 *  concurrency to worry about); on the client we hydrate once so navigations /
 *  post-mutation refreshes aren't clobbered by the stale initial payload. */
export function hydrateWorkspace(data: WorkspaceData) {
  if (typeof window === "undefined") {
    apply(data);
    hydrated = true;
  } else if (!hydrated) {
    apply(data);
    hydrated = true;
  }
}

/** Re-read the persisted workspace after a mutation and notify subscribers. */
async function refresh() {
  const data = await getWorkspace();
  apply(data);
  emit();
}

/* ---------------- reads ---------------- */

const getLeads = () => leads;
const getDetails = () => details;
const getContacts = () => contacts;
const getOutreach = () => outreach;
const getReminders = () => reminders;
const getTasks = () => tasks;

export function useLeads(): JobLead[] {
  return useSyncExternalStore(subscribe, getLeads, getLeads);
}
export function useLead(id: string): JobLead | undefined {
  return useLeads().find((l) => l.id === id);
}
export function useLeadDetail(id: string): JobLeadDetail | undefined {
  return useSyncExternalStore(subscribe, getDetails, getDetails)[id];
}
export function useContacts(): Contact[] {
  return useSyncExternalStore(subscribe, getContacts, getContacts);
}
export function useContactsForLead(leadId: string): Contact[] {
  return useContacts().filter((c) => c.leadId === leadId);
}
export function useOutreach(): OutreachMessage[] {
  return useSyncExternalStore(subscribe, getOutreach, getOutreach);
}
export function useOutreachForLead(leadId: string): OutreachMessage[] {
  return useOutreach().filter((m) => m.leadId === leadId);
}
export function useReminders(): Reminder[] {
  return useSyncExternalStore(subscribe, getReminders, getReminders);
}
export function useRemindersForLead(leadId: string): Reminder[] {
  return useReminders().filter((r) => r.leadId === leadId);
}
export function useTasks(): Task[] {
  return useSyncExternalStore(subscribe, getTasks, getTasks);
}

/** Current lead by id (non-hook), for use inside other selectors. */
function findLead(leadId: string): JobLead | undefined {
  return leads.find((l) => l.id === leadId);
}
export function getStatus(leadId: string): LeadStatus {
  return findLead(leadId)?.status ?? "new";
}

/** Live status for one lead. */
export function useLeadStatus(leadId: string): {
  status: LeadStatus;
  closeOutcome: CloseOutcome | null;
} {
  const lead = useLead(leadId);
  return {
    status: lead?.status ?? "new",
    closeOutcome: lead?.closeOutcome ?? null,
  };
}

/* ---------------- mutations (persist, then refresh) ---------------- */

/** Friendly toast message for a status change. */
function statusToast(status: LeadStatus, outcome: CloseOutcome | null) {
  if (status === "discarded") return toast.success("Lead discarded", "Moved to Archive.");
  if (status === "closed")
    return toast.success(
      "Lead closed",
      outcome ? CLOSE_OUTCOME_LABELS[outcome] : undefined,
    );
  return toast.success("Status updated", `Marked as ${LEAD_STATUS_LABELS[status]}.`);
}

export async function setLeadStatus(
  leadId: string,
  status: LeadStatus,
  closeOutcome: CloseOutcome | null = null,
) {
  try {
    await setLeadStatusAction(leadId, status, closeOutcome);
    await refresh();
    statusToast(status, closeOutcome);
  } catch (e) {
    toast.error("Couldn't update lead", e instanceof Error ? e.message : undefined);
  }
}

/** Create a lead manually (Add-lead modal); refreshes on success so the new
 *  lead appears. Returns the action result so the dialog can surface errors. */
export async function createLead(input: {
  title: string;
  company: string;
  location: string;
  remote: boolean;
  jobUrl: string;
  status: LeadStatus;
  tags: string[];
  jdText: string;
  notes: string;
  contact?: {
    name: string;
    title: string;
    linkedinUrl: string;
    connectionType: ConnectionType;
  };
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const res = await createLeadAction(input);
  if (res.ok) await refresh();
  return res;
}

/** Edit a lead's core fields + JD/notes. Refreshes on success; returns the
 *  result so the dialog can surface validation / duplicate-URL errors. */
export async function updateLead(
  leadId: string,
  input: {
    title: string;
    company: string;
    location: string;
    remote: boolean;
    jobUrl: string;
    status: LeadStatus;
    tags: string[];
    jdText: string;
    notes: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await updateLeadAction(leadId, input);
  if (res.ok) await refresh();
  return res;
}

/** Permanently delete one or more leads (Archive trash). */
export async function deleteLeads(ids: string[]) {
  if (ids.length === 0) return;
  try {
    await deleteLeadsAction(ids);
    await refresh();
    toast.success(
      ids.length === 1 ? "Lead deleted" : `${ids.length} leads deleted`,
      "This can't be undone.",
    );
  } catch (e) {
    toast.error("Couldn't delete", e instanceof Error ? e.message : undefined);
  }
}

export async function addContact(input: {
  leadId: string;
  name: string;
  title: string;
  linkedinUrl: string;
  connectionType: ConnectionType;
  aiParsed: boolean;
}) {
  try {
    await addContactAction(input);
    await refresh();
    toast.success("Contact added", input.name);
  } catch (e) {
    toast.error("Couldn't add contact", e instanceof Error ? e.message : undefined);
  }
}

export async function updateContact(
  id: string,
  patch: {
    name: string;
    title: string;
    linkedinUrl: string;
    connectionType: ConnectionType;
  },
) {
  try {
    await updateContactAction(id, patch);
    await refresh();
    toast.success("Contact updated", patch.name);
  } catch (e) {
    toast.error("Couldn't update contact", e instanceof Error ? e.message : undefined);
  }
}

export async function deleteContact(id: string) {
  try {
    await deleteContactAction(id);
    await refresh();
    toast.success("Contact removed");
  } catch (e) {
    toast.error("Couldn't remove contact", e instanceof Error ? e.message : undefined);
  }
}

/** Mark a drafted message sent + schedule the follow-up reminder/task. The
 *  follow-up interval is read from saved settings server-side. */
export async function markSent(input: {
  leadId: string;
  contactId: string;
  kind: OutreachKind;
  channel: string;
  draftBody: string;
}) {
  try {
    await markSentAction(input);
    await refresh();
    toast.success("Message marked as sent", "Follow-up reminder scheduled.");
  } catch (e) {
    toast.error("Couldn't mark as sent", e instanceof Error ? e.message : undefined);
  }
}

export async function addReminderManual(input: {
  leadId: string;
  dueDate: string;
  label: string;
  outreachMessageId: string | null;
}) {
  try {
    await addReminderManualAction(input);
    await refresh();
    toast.success("Reminder added");
  } catch (e) {
    toast.error("Couldn't add reminder", e instanceof Error ? e.message : undefined);
  }
}

export async function setReminderOutcome(id: string, outcome: ReminderOutcome) {
  try {
    await setReminderOutcomeAction(id, outcome);
    await refresh();
    toast.success("Reminder updated", REMINDER_OUTCOME_LABELS[outcome]);
  } catch (e) {
    toast.error("Couldn't update reminder", e instanceof Error ? e.message : undefined);
  }
}

export async function snoozeReminder(id: string, newDueDate: string) {
  try {
    await snoozeReminderAction(id, newDueDate);
    await refresh();
    toast.success("Reminder snoozed");
  } catch (e) {
    toast.error("Couldn't snooze reminder", e instanceof Error ? e.message : undefined);
  }
}

export async function deleteReminder(id: string) {
  try {
    await deleteReminderAction(id);
    await refresh();
    toast.success("Reminder deleted");
  } catch (e) {
    toast.error("Couldn't delete reminder", e instanceof Error ? e.message : undefined);
  }
}

export async function completeTask(id: string) {
  try {
    await completeTaskAction(id);
    await refresh();
    toast.success("Task completed");
  } catch (e) {
    toast.error("Couldn't complete task", e instanceof Error ? e.message : undefined);
  }
}

/* ---------------- settings & resumes (persist, then refresh) -------------- */

const getResumes = () => resumes;
const getDefaultResumeId = () => defaultResumeId;
const getAppSettings = () => appSettings;
const getProfile = () => profile;
const getGoogle = () => google;
const getAiSettings = () => aiSettings;
const getGmailConfig = () => gmailConfig;

export function useResumes(): Resume[] {
  return useSyncExternalStore(subscribe, getResumes, getResumes);
}

/** [id, setDefault] — matches the old localStorage hook's shape. */
export function useDefaultResumeId(): [string, (id: string) => void] {
  const id = useSyncExternalStore(
    subscribe,
    getDefaultResumeId,
    getDefaultResumeId,
  );
  const setDefault = (next: string) => {
    void (async () => {
      await setDefaultResumeAction(next);
      await refresh();
    })();
  };
  return [id, setDefault];
}

export function useAppSettings(): [
  AppSettings,
  (patch: Partial<AppSettings>) => void,
] {
  const settings = useSyncExternalStore(
    subscribe,
    getAppSettings,
    getAppSettings,
  );
  const update = (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    void (async () => {
      await updateFollowUpsAction(next);
      await refresh();
    })();
  };
  return [settings, update];
}

export function useGmailSettings(): [
  GmailConfigData,
  (patch: Partial<GmailConfigData>) => void,
] {
  const cfg = useSyncExternalStore(subscribe, getGmailConfig, getGmailConfig);
  const update = (patch: Partial<GmailConfigData>) => {
    const next = { ...cfg, ...patch };
    void (async () => {
      await updateGmailConfigAction({
        senders: next.senders,
        label: next.label,
        subjectKeywords: next.subjectKeywords,
        lookbackDays: next.lookbackDays,
      });
      await refresh();
    })();
  };
  return [cfg, update];
}

export function useProfile(): Profile {
  return useSyncExternalStore(subscribe, getProfile, getProfile);
}
export function useGoogle(): GoogleConnection {
  return useSyncExternalStore(subscribe, getGoogle, getGoogle);
}
export function useAiSettings(): AiSettings {
  return useSyncExternalStore(subscribe, getAiSettings, getAiSettings);
}

export async function updateProfile(input: { name: string; mobile: string }) {
  await updateProfileAction(input);
  await refresh();
}

export async function updateAiSettings(input: {
  provider: AiProvider;
  model: string;
}) {
  await updateAiSettingsAction(input);
  await refresh();
}

export async function saveAiKey(plainKey: string) {
  await saveAiKeyAction(plainKey);
  await refresh();
}

export async function removeAiKey() {
  await removeAiKeyAction();
  await refresh();
}

/** Upload a résumé file (server extracts + stores text). Returns the result. */
export async function uploadResume(file: File, label: string) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("label", label);
  const res = await uploadResumeAction(fd);
  if (res.ok) await refresh();
  return res;
}

/** Fetch a stored résumé file for download. */
export function getResumeFile(id: string) {
  return getResumeFileAction(id);
}

export async function renameResume(id: string, label: string) {
  await renameResumeAction(id, label);
  await refresh();
}

export async function deleteResume(id: string) {
  await deleteResumeAction(id);
  await refresh();
}

export async function disconnectGoogle() {
  await disconnectGoogleAction();
  await refresh();
}

/** Save a lead's JD (no AI), then refresh so the saved detail reflects live. */
export async function saveJd(
  leadId: string,
  jdText: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await saveJdAction(leadId, jdText);
  await refresh();
  return res;
}

/** Summarize a lead's JD with AI; also persists the JD (+ summary) to the lead
 *  and refreshes so the saved detail reflects live. */
export async function summarizeJd(
  leadId: string,
  jdText: string,
): Promise<{ ok: true; summary: string } | { ok: false; error: string }> {
  const res = await summarizeJdAction(leadId, jdText);
  await refresh();
  return res;
}

/** Manually run the Gmail sync for the current user, then refresh so newly
 *  ingested leads appear. */
export async function syncGmail(): Promise<SyncResult> {
  const result = await syncMyGmailAction();
  await refresh();
  return result;
}

/* ---------------- sync schedule + ingestion issues ---------------- */

const getSyncInterval = () => syncIntervalHours;
const getGmailSync = () => gmailSync;
const getIngestErrors = () => ingestErrors;

export function useSyncInterval(): [number, (hours: number) => void] {
  const hours = useSyncExternalStore(subscribe, getSyncInterval, getSyncInterval);
  const set = (h: number) => {
    void (async () => {
      await updateSyncIntervalAction(h);
      await refresh();
    })();
  };
  return [hours, set];
}

export function useGmailSync(): GmailSyncStatus {
  return useSyncExternalStore(subscribe, getGmailSync, getGmailSync);
}

export function useIngestErrors(): IngestError[] {
  return useSyncExternalStore(subscribe, getIngestErrors, getIngestErrors);
}

export async function clearIngestErrors() {
  await clearIngestErrorsAction();
  await refresh();
}

const getAiPrompts = () => aiPrompts;
export function useAiPrompts(): { summary: string; draft: string; score: string } {
  return useSyncExternalStore(subscribe, getAiPrompts, getAiPrompts);
}
export async function updateAiPrompts(input: {
  summary: string;
  draft: string;
  score: string;
}) {
  await updateAiPromptsAction(input);
  await refresh();
}

/* ---------------- fit scores (AI, on-demand) ---------------- */

const getFitScores = () => fitScores;
/** Cached fit score for a (lead, resume) pair, or null if not calculated. */
export function useFitScore(
  leadId: string,
  resumeId: string,
): FitScore | null {
  const all = useSyncExternalStore(subscribe, getFitScores, getFitScores);
  return all[fitScoreKey(leadId, resumeId)] ?? null;
}

/** The whole fit-scores map (keyed by fitScoreKey) — for sorting a column by
 *  score without a hook per card. */
export function useAllFitScores(): Record<string, FitScore> {
  return useSyncExternalStore(subscribe, getFitScores, getFitScores);
}

/** Compute/refresh the AI fit score for a (lead, resume) pair. */
export async function scoreFit(leadId: string, resumeId: string) {
  const res = await scoreFitAction(leadId, resumeId);
  if (res.ok) await refresh();
  return res;
}

/* ---------------- resume text (for AI scoring) ---------------- */

export function getResumeText(id: string): Promise<string> {
  return getResumeTextAction(id);
}
export async function updateResumeText(id: string, text: string) {
  await updateResumeTextAction(id, text);
  await refresh();
}

/** Read the current sync schedule imperatively (for the auto-sync timer). */
export function currentSyncInfo(): {
  intervalHours: number;
  lastRunAt: string | null;
  connected: boolean;
} {
  return {
    intervalHours: syncIntervalHours,
    lastRunAt: gmailSync.lastRunAt,
    connected: google.connected,
  };
}

/* ---------------- derived: per-contact history across leads (FR-6.1) ------- */

export interface PersonLead {
  lead: JobLead;
  contact: Contact;
  messages: OutreachMessage[];
}

export interface Person {
  key: string;
  name: string;
  title: string;
  linkedinUrl: string | null;
  connectionTypes: ConnectionType[];
  aiParsed: boolean;
  leads: PersonLead[];
  messageCount: number;
  lastActivity: string;
}

export function usePeople(): Person[] {
  const allContacts = useContacts();
  const allOutreach = useOutreach();
  const allLeads = useLeads();

  const byKey = new Map<string, Contact[]>();
  for (const c of allContacts) {
    const key = contactPersonKey(c);
    const list = byKey.get(key);
    if (list) list.push(c);
    else byKey.set(key, [c]);
  }

  const people: Person[] = [];
  for (const [key, records] of byKey) {
    const sorted = [...records].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    const personLeads: PersonLead[] = [];
    for (const contact of sorted) {
      const lead = allLeads.find((l) => l.id === contact.leadId);
      if (!lead) continue;
      const messages = allOutreach
        .filter((m) => m.contactId === contact.id)
        .sort((a, b) => (b.sentAt ?? b.createdAt).localeCompare(a.sentAt ?? a.createdAt));
      personLeads.push({ lead, contact, messages });
    }
    if (personLeads.length === 0) continue;

    const connectionTypes = [...new Set(sorted.map((c) => c.connectionType))];
    const messageCount = personLeads.reduce((n, l) => n + l.messages.length, 0);
    const dates = [
      ...sorted.map((c) => c.addedAt),
      ...personLeads.flatMap((l) => l.messages.map((m) => m.sentAt ?? m.createdAt)),
    ];
    const lastActivity = dates.sort().at(-1) ?? sorted[0].addedAt;

    people.push({
      key,
      name: sorted[0].name,
      title: sorted.find((c) => c.title.trim())?.title ?? "",
      linkedinUrl: sorted.find((c) => c.linkedinUrl)?.linkedinUrl ?? null,
      connectionTypes,
      aiParsed: sorted.some((c) => c.aiParsed),
      leads: personLeads,
      messageCount,
      lastActivity,
    });
  }

  people.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
  return people;
}

export function usePerson(key: string | null): Person | null {
  const people = usePeople();
  if (!key) return null;
  return people.find((p) => p.key === key) ?? null;
}

/* ---------------- derived: per-lead timeline (FR-6.2) ---------------- */

export type TimelineKind =
  | "captured"
  | "contact-added"
  | "message"
  | "reminder"
  | "reminder-resolved"
  | "status";

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  date: string;
  title: string;
  detail?: string;
}

export function useLeadTimeline(leadId: string): TimelineEvent[] {
  const leadContacts = useContactsForLead(leadId);
  const leadOutreach = useOutreachForLead(leadId);
  const leadReminders = useRemindersForLead(leadId);
  const lead = useLead(leadId);
  const { status, closeOutcome } = useLeadStatus(leadId);

  const events: TimelineEvent[] = [];

  if (lead) {
    events.push({
      id: "captured",
      kind: "captured",
      date: lead.capturedAt,
      title: "Lead captured",
      detail: `${lead.company} · ${lead.title}`,
    });
  }

  for (const c of leadContacts) {
    events.push({
      id: `contact-${c.id}`,
      kind: "contact-added",
      date: c.addedAt,
      title: `Contact added — ${c.name}`,
      detail: c.title || undefined,
    });
  }

  for (const m of leadOutreach) {
    const when = m.status === "sent" ? (m.sentAt ?? m.createdAt) : m.createdAt;
    events.push({
      id: `msg-${m.id}`,
      kind: "message",
      date: when,
      title: `${OUTREACH_KIND_LABELS[m.kind]} ${m.status === "sent" ? "sent" : "drafted"} · ${m.channel}`,
    });
  }

  for (const r of leadReminders) {
    const label =
      r.reason ?? (r.manual ? r.label || "Manual reminder" : `Reminder ${r.sequence}`);
    events.push({
      id: `rem-${r.id}`,
      kind: "reminder",
      date: r.dueDate,
      title:
        r.outcome === "pending"
          ? `${label} due`
          : `${label} · ${REMINDER_OUTCOME_LABELS[r.outcome]}`,
    });
  }

  events.push({
    id: "status",
    kind: "status",
    date: "9999-12-31",
    title: `Status: ${LEAD_STATUS_LABELS[status]}`,
    detail:
      status === "closed" && closeOutcome
        ? CLOSE_OUTCOME_LABELS[closeOutcome]
        : undefined,
  });

  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}

/* ---------------- derived: To-do ---------------- */

export interface TodoItem {
  task: Task;
  lead: JobLead;
  overdue: boolean;
}
export interface TodoNudge {
  lead: JobLead;
  message: string;
}
export interface TodoGroups {
  overdue: TodoItem[];
  today: TodoItem[];
  upcoming: TodoItem[];
  noDate: TodoItem[];
  nudges: TodoNudge[];
  openCount: number;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function nudgeMessage(status: LeadStatus): string {
  if (status === "applied") return "Follow up or close this lead";
  if (status === "reviewing") return "Decide next step or close";
  return "Review — add a contact, or discard";
}

export function useTodos(): TodoGroups {
  const allTasks = useTasks();
  const allLeads = useLeads();

  const today = todayISO();
  const overdue: TodoItem[] = [];
  const todayItems: TodoItem[] = [];
  const upcoming: TodoItem[] = [];
  const noDate: TodoItem[] = [];
  const openTaskJobIds = new Set<string>();

  for (const task of allTasks) {
    if (task.status !== "open") continue;
    const lead = allLeads.find((l) => l.id === task.jobId);
    if (!lead || !isJobOpen(lead.status)) continue;
    openTaskJobIds.add(lead.id);
    const item: TodoItem = {
      task,
      lead,
      overdue: !!task.dueDate && task.dueDate < today,
    };
    if (!task.dueDate) noDate.push(item);
    else if (task.dueDate < today) overdue.push(item);
    else if (task.dueDate === today) todayItems.push(item);
    else upcoming.push(item);
  }

  const byDate = (a: TodoItem, b: TodoItem) =>
    (a.task.dueDate ?? "").localeCompare(b.task.dueDate ?? "");
  overdue.sort(byDate);
  todayItems.sort(byDate);
  upcoming.sort(byDate);

  const nudges: TodoNudge[] = [];
  for (const lead of allLeads) {
    if (isJobOpen(lead.status) && !openTaskJobIds.has(lead.id)) {
      nudges.push({ lead, message: nudgeMessage(lead.status) });
    }
  }

  const openCount =
    overdue.length + todayItems.length + upcoming.length + noDate.length;
  return { overdue, today: todayItems, upcoming, noDate, nudges, openCount };
}

/* ---------------- derived: notifications (top-bar bell) ---------------- */

export interface StoreNotification {
  id: string;
  kind: "new-lead" | "reminder-due";
  title: string;
  detail: string;
  leadId: string;
}

export function useNotifications(): StoreNotification[] {
  const allLeads = useLeads();
  const allReminders = useReminders();
  const items: StoreNotification[] = [];

  for (const r of allReminders) {
    if (r.outcome !== "pending") continue;
    const lead = allLeads.find((l) => l.id === r.leadId);
    if (!lead) continue;
    items.push({
      id: `rem-${r.id}`,
      kind: "reminder-due",
      title: "Follow-up due",
      detail: `${lead.title} · ${lead.company}`,
      leadId: lead.id,
    });
  }
  // Newest leads first, so the panel's top entries are the most recent
  // captures (and shift down as new alerts arrive).
  const newLeads = allLeads
    .filter((l) => l.status === "new")
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  for (const l of newLeads) {
    items.push({
      id: `lead-${l.id}`,
      kind: "new-lead",
      title: "New lead captured",
      detail: `${l.title} · ${l.company}`,
      leadId: l.id,
    });
  }
  return items;
}
