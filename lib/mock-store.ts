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
  deleteContactAction,
  deleteReminderAction,
  getWorkspace,
  markSentAction,
  setLeadStatusAction,
  setReminderOutcomeAction,
  snoozeReminderAction,
  updateContactAction,
} from "@/actions/data";
import { contactPersonKey, isJobOpen } from "@/lib/types";
import {
  CLOSE_OUTCOME_LABELS,
  LEAD_STATUS_LABELS,
  OUTREACH_KIND_LABELS,
  REMINDER_OUTCOME_LABELS,
} from "@/lib/types";
import type {
  CloseOutcome,
  ConnectionType,
  Contact,
  JobLead,
  JobLeadDetail,
  LeadStatus,
  OutreachKind,
  OutreachMessage,
  Reminder,
  ReminderOutcome,
  Task,
} from "@/lib/types";
import type { WorkspaceData } from "@/lib/queries";

/* ---------------- state ---------------- */

let leads: JobLead[] = [];
let details: Record<string, JobLeadDetail> = {};
let contacts: Contact[] = [];
let outreach: OutreachMessage[] = [];
let reminders: Reminder[] = [];
let tasks: Task[] = [];
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

export async function setLeadStatus(
  leadId: string,
  status: LeadStatus,
  closeOutcome: CloseOutcome | null = null,
) {
  await setLeadStatusAction(leadId, status, closeOutcome);
  await refresh();
}

export async function addContact(input: {
  leadId: string;
  name: string;
  title: string;
  linkedinUrl: string;
  connectionType: ConnectionType;
  aiParsed: boolean;
}) {
  await addContactAction(input);
  await refresh();
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
  await updateContactAction(id, patch);
  await refresh();
}

export async function deleteContact(id: string) {
  await deleteContactAction(id);
  await refresh();
}

/** Mark a drafted message sent + schedule the follow-up reminder/task. */
export async function markSent(input: {
  leadId: string;
  contactId: string;
  kind: OutreachKind;
  channel: string;
  draftBody: string;
  intervalDays: number;
}) {
  await markSentAction(input);
  await refresh();
}

export async function addReminderManual(input: {
  leadId: string;
  dueDate: string;
  label: string;
  outreachMessageId: string | null;
}) {
  await addReminderManualAction(input);
  await refresh();
}

export async function setReminderOutcome(id: string, outcome: ReminderOutcome) {
  await setReminderOutcomeAction(id, outcome);
  await refresh();
}

export async function snoozeReminder(id: string, newDueDate: string) {
  await snoozeReminderAction(id, newDueDate);
  await refresh();
}

export async function deleteReminder(id: string) {
  await deleteReminderAction(id);
  await refresh();
}

export async function completeTask(id: string) {
  await completeTaskAction(id);
  await refresh();
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
    const label = r.manual ? r.label || "Manual reminder" : `Reminder ${r.sequence}`;
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
  for (const l of allLeads) {
    if (l.status !== "new") continue;
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
