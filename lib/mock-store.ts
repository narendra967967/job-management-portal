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
import { mockLeads, mockOutreach, mockReminders } from "@/lib/mock-data";
import { isJobOpen } from "@/lib/types";
import type {
  CloseOutcome,
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

const getOutreach = () => outreach;
const getReminders = () => reminders;
const getTasks = () => tasks;
const getStatusOverrides = () => statusOverrides;

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
