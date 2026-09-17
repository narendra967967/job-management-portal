"use client";

// PHASE 1 in-memory store tying Jobs ↔ Reminders ↔ Tasks together.
//
// The rules (agreed design):
//  - A job is OPEN (new/reviewing/applied) or TERMINAL (discarded/closed).
//  - Reminders are scheduled prompts. A Task is the actionable To-do item; every
//    task belongs to a job, and may link to the reminder that spawned it.
//  - Creating a reminder also creates a linked follow-up task.
//  - Completing/snoozing a reminder syncs its linked task, and vice-versa.
//  - Marking a job terminal AUTO-CANCELS its pending reminders + open tasks — no
//    dangling to-dos on a job you've dropped or closed.
//  - The To-do view = open tasks on open jobs, plus a derived "plan next step or
//    close" nudge for any open job that has no open task.
//
// Phase 3 replaces all of this with Server Actions against Postgres.

import { useSyncExternalStore } from "react";
import {
  mockContacts,
  mockLeads,
  mockOutreach,
  mockReminders,
} from "@/lib/mock-data";
import {
  CLOSE_OUTCOME_LABELS,
  LEAD_STATUS_LABELS,
  OUTREACH_KIND_LABELS,
  REMINDER_OUTCOME_LABELS,
  contactPersonKey,
  isJobOpen,
} from "@/lib/types";
import type {
  CloseOutcome,
  ConnectionType,
  Contact,
  JobLead,
  LeadStatus,
  OutreachMessage,
  Reminder,
  ReminderOutcome,
  Task,
} from "@/lib/types";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

interface StatusOverride {
  status: LeadStatus;
  closeOutcome: CloseOutcome | null;
}

function reminderToTask(r: Reminder): Task {
  const lead = mockLeads.find((l) => l.id === r.leadId);
  const done = r.outcome !== "pending";
  return {
    id: `task-${r.id}`,
    jobId: r.leadId,
    reminderId: r.id,
    title:
      r.manual && r.label
        ? r.label
        : `Follow up — ${lead?.company ?? "lead"}`,
    kind: "follow-up",
    dueDate: r.dueDate,
    status: done ? "done" : "open",
    createdAt: r.dueDate,
    completedAt: done ? r.dueDate : null,
  };
}

let statusOverrides: Record<string, StatusOverride> = {};
let contacts: Contact[] = [...mockContacts];
let outreach: OutreachMessage[] = [...mockOutreach];
let reminders: Reminder[] = [...mockReminders];
let tasks: Task[] = mockReminders.map(reminderToTask);

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/* ---- job status ---- */

function baseStatus(leadId: string): LeadStatus {
  return mockLeads.find((l) => l.id === leadId)?.status ?? "new";
}

export function getStatus(leadId: string): LeadStatus {
  return statusOverrides[leadId]?.status ?? baseStatus(leadId);
}

export function getCloseOutcome(leadId: string): CloseOutcome | null {
  return statusOverrides[leadId]?.closeOutcome ?? null;
}

export function setLeadStatus(
  leadId: string,
  status: LeadStatus,
  closeOutcome: CloseOutcome | null = null,
) {
  statusOverrides = {
    ...statusOverrides,
    [leadId]: { status, closeOutcome: status === "closed" ? closeOutcome : null },
  };
  // Terminal → cancel pending reminders + open tasks for this job.
  if (!isJobOpen(status)) {
    reminders = reminders.map((r) =>
      r.leadId === leadId && r.outcome === "pending"
        ? { ...r, outcome: "closed" as ReminderOutcome }
        : r,
    );
    tasks = tasks.map((t) =>
      t.jobId === leadId && t.status === "open"
        ? { ...t, status: "done" as const, completedAt: todayISO() }
        : t,
    );
  }
  emit();
}

/* ---- contacts ---- */

export function addContact(input: Omit<Contact, "id" | "addedAt">) {
  contacts = [
    { ...input, id: `contact-${Date.now()}`, addedAt: todayISO() },
    ...contacts,
  ];
  emit();
}

export function updateContact(id: string, patch: Partial<Omit<Contact, "id">>) {
  contacts = contacts.map((c) => (c.id === id ? { ...c, ...patch } : c));
  emit();
}

export function deleteContact(id: string) {
  contacts = contacts.filter((c) => c.id !== id);
  emit();
}

/* ---- outreach ---- */

export function addOutreach(message: OutreachMessage) {
  outreach = [message, ...outreach];
  emit();
}

/* ---- reminders (each keeps a linked task in sync) ---- */

export function addReminder(reminder: Reminder) {
  reminders = [reminder, ...reminders];
  tasks = [reminderToTask(reminder), ...tasks];
  emit();
}

export function completeReminder(id: string) {
  reminders = reminders.map((r) =>
    r.id === id ? { ...r, outcome: "closed" as ReminderOutcome } : r,
  );
  tasks = tasks.map((t) =>
    t.reminderId === id && t.status === "open"
      ? { ...t, status: "done" as const, completedAt: todayISO() }
      : t,
  );
  emit();
}

/** Snooze / reschedule to a new due date (keeps the reminder & task active). */
export function snoozeReminder(id: string, newDueDate: string) {
  reminders = reminders.map((r) =>
    r.id === id
      ? { ...r, outcome: "pending" as ReminderOutcome, dueDate: newDueDate }
      : r,
  );
  tasks = tasks.map((t) =>
    t.reminderId === id
      ? { ...t, status: "open" as const, completedAt: null, dueDate: newDueDate }
      : t,
  );
  emit();
}

export function setReminderOutcome(id: string, outcome: ReminderOutcome) {
  reminders = reminders.map((r) => (r.id === id ? { ...r, outcome } : r));
  const done = outcome !== "pending";
  tasks = tasks.map((t) =>
    t.reminderId === id
      ? {
          ...t,
          status: done ? "done" : "open",
          completedAt: done ? todayISO() : null,
        }
      : t,
  );
  emit();
}

export function deleteReminder(id: string) {
  reminders = reminders.filter((r) => r.id !== id);
  tasks = tasks.filter((t) => t.reminderId !== id);
  emit();
}

export function nextReminderSequence(leadId: string): number {
  return reminders.filter((r) => r.leadId === leadId).length + 1;
}

/* ---- tasks ---- */

export function addTask(
  input: Omit<Task, "id" | "status" | "createdAt" | "completedAt">,
) {
  tasks = [
    {
      ...input,
      id: `task-${Date.now()}`,
      status: "open",
      createdAt: todayISO(),
      completedAt: null,
    },
    ...tasks,
  ];
  emit();
}

export function completeTask(id: string) {
  const task = tasks.find((t) => t.id === id);
  tasks = tasks.map((t) =>
    t.id === id ? { ...t, status: "done" as const, completedAt: todayISO() } : t,
  );
  if (task?.reminderId) {
    reminders = reminders.map((r) =>
      r.id === task.reminderId
        ? { ...r, outcome: "closed" as ReminderOutcome }
        : r,
    );
  }
  emit();
}

export function deleteTask(id: string) {
  tasks = tasks.filter((t) => t.id !== id);
  emit();
}

/* ---- reads (stable snapshots) ---- */

const getContacts = () => contacts;
const getOutreach = () => outreach;
const getReminders = () => reminders;
const getTasks = () => tasks;
const getStatusOverrides = () => statusOverrides;

export function useContacts(): Contact[] {
  return useSyncExternalStore(subscribe, getContacts, getContacts);
}
export function useContactsForLead(leadId: string): Contact[] {
  return useContacts().filter((c) => c.leadId === leadId);
}
export function useOutreach(): OutreachMessage[] {
  return useSyncExternalStore(subscribe, getOutreach, getOutreach);
}
export function useReminders(): Reminder[] {
  return useSyncExternalStore(subscribe, getReminders, getReminders);
}
export function useTasks(): Task[] {
  return useSyncExternalStore(subscribe, getTasks, getTasks);
}
/** Subscribe to status changes (returns the overrides map; use with getStatus). */
export function useStatusOverrides(): Record<string, StatusOverride> {
  return useSyncExternalStore(subscribe, getStatusOverrides, getStatusOverrides);
}

export function useOutreachForLead(leadId: string): OutreachMessage[] {
  return useOutreach().filter((m) => m.leadId === leadId);
}
export function useRemindersForLead(leadId: string): Reminder[] {
  return useReminders().filter((r) => r.leadId === leadId);
}

/** Live status for one lead (re-renders when it changes). */
export function useLeadStatus(leadId: string): {
  status: LeadStatus;
  closeOutcome: CloseOutcome | null;
} {
  const overrides = useStatusOverrides();
  const o = overrides[leadId];
  return {
    status: o?.status ?? baseStatus(leadId),
    closeOutcome: o?.closeOutcome ?? null,
  };
}

/* ---- derived To-do ---- */

export interface TodoItem {
  task: Task;
  lead: (typeof mockLeads)[number];
  overdue: boolean;
}

export interface TodoNudge {
  lead: (typeof mockLeads)[number];
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

function nudgeMessage(status: LeadStatus): string {
  if (status === "applied") return "Follow up or close this lead";
  if (status === "reviewing") return "Decide next step or close";
  return "Review — add a contact, or discard";
}

/** The To-do view: open tasks on open jobs, grouped by urgency, + nudges. */
export function useTodos(): TodoGroups {
  const allTasks = useTasks();
  useStatusOverrides(); // subscribe so status changes re-run this

  const today = todayISO();
  const overdue: TodoItem[] = [];
  const todayItems: TodoItem[] = [];
  const upcoming: TodoItem[] = [];
  const noDate: TodoItem[] = [];

  const openTaskJobIds = new Set<string>();

  for (const task of allTasks) {
    if (task.status !== "open") continue;
    const lead = mockLeads.find((l) => l.id === task.jobId);
    if (!lead || !isJobOpen(getStatus(lead.id))) continue;
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

  // Nudge every open job that has no open task → drives closure.
  const nudges: TodoNudge[] = [];
  for (const lead of mockLeads) {
    const status = getStatus(lead.id);
    if (isJobOpen(status) && !openTaskJobIds.has(lead.id)) {
      nudges.push({ lead, message: nudgeMessage(status) });
    }
  }

  const openCount =
    overdue.length + todayItems.length + upcoming.length + noDate.length;

  return { overdue, today: todayItems, upcoming, noDate, nudges, openCount };
}

/* ---- derived: per-contact history across leads (FR-6.1) ---- */

export interface PersonLead {
  lead: JobLead;
  contact: Contact; // this person's contact record on that lead
  messages: OutreachMessage[]; // outreach to that record
}

export interface Person {
  key: string;
  name: string;
  title: string; // most recent non-empty title seen
  linkedinUrl: string | null;
  connectionTypes: ConnectionType[];
  aiParsed: boolean; // true if any of the person's records came from AI parse
  leads: PersonLead[]; // one entry per lead the person appears on, newest first
  messageCount: number;
  lastActivity: string; // ISO date of the newest message or capture
}

/** Group all contacts into people (by contactPersonKey) with their outreach. */
export function usePeople(): Person[] {
  const allContacts = useContacts();
  const allOutreach = useOutreach();

  const byKey = new Map<string, Contact[]>();
  for (const c of allContacts) {
    const key = contactPersonKey(c);
    const list = byKey.get(key);
    if (list) list.push(c);
    else byKey.set(key, [c]);
  }

  const people: Person[] = [];
  for (const [key, records] of byKey) {
    // Newest record first so the "current" title/type wins.
    const sorted = [...records].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    const leads: PersonLead[] = [];
    for (const contact of sorted) {
      const lead = mockLeads.find((l) => l.id === contact.leadId);
      if (!lead) continue;
      const messages = allOutreach
        .filter((m) => m.contactId === contact.id)
        .sort((a, b) => (b.sentAt ?? b.createdAt).localeCompare(a.sentAt ?? a.createdAt));
      leads.push({ lead, contact, messages });
    }
    if (leads.length === 0) continue;

    const connectionTypes = [...new Set(sorted.map((c) => c.connectionType))];
    const messageCount = leads.reduce((n, l) => n + l.messages.length, 0);
    const dates = [
      ...sorted.map((c) => c.addedAt),
      ...leads.flatMap((l) => l.messages.map((m) => m.sentAt ?? m.createdAt)),
    ];
    const lastActivity = dates.sort().at(-1) ?? sorted[0].addedAt;

    people.push({
      key,
      name: sorted[0].name,
      title: sorted.find((c) => c.title.trim())?.title ?? "",
      linkedinUrl: sorted.find((c) => c.linkedinUrl)?.linkedinUrl ?? null,
      connectionTypes,
      aiParsed: sorted.some((c) => c.aiParsed),
      leads,
      messageCount,
      lastActivity,
    });
  }

  people.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
  return people;
}

/** One person by identity key (for the contact-history dialog). */
export function usePerson(key: string | null): Person | null {
  const people = usePeople();
  if (!key) return null;
  return people.find((p) => p.key === key) ?? null;
}

/* ---- derived: per-lead activity timeline (FR-6.2) ---- */

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
  date: string; // ISO date used for ordering
  title: string;
  detail?: string;
}

/**
 * Chronological lead timeline: captured → contacts added → messages sent →
 * reminders scheduled/resolved → current status/outcome (FR-6.2).
 *
 * Sourced from the timestamps we actually store today. Status *transitions*
 * aren't individually timestamped in Phase 1, so the current status/outcome is
 * shown as the closing state rather than a dated history — Phase 2's schema can
 * add per-row timestamps (contacts.added_at exists; reminders need created_at)
 * or a small events table if a fully dated audit trail proves worth it.
 */
export function useLeadTimeline(leadId: string): TimelineEvent[] {
  const leadContacts = useContactsForLead(leadId);
  const leadOutreach = useOutreachForLead(leadId);
  const leadReminders = useRemindersForLead(leadId);
  const { status, closeOutcome } = useLeadStatus(leadId);

  const lead = mockLeads.find((l) => l.id === leadId);
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

  // Closing state — the current status (and outcome when closed).
  events.push({
    id: "status",
    kind: "status",
    date: "9999-12-31", // always sorts last
    title: `Status: ${LEAD_STATUS_LABELS[status]}`,
    detail:
      status === "closed" && closeOutcome
        ? CLOSE_OUTCOME_LABELS[closeOutcome]
        : undefined,
  });

  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}
