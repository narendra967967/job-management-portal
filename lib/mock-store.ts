"use client";

// PHASE 1 in-memory store for outreach messages + reminders.
//
// The mock arrays are static, but a few flows now MUTATE data: marking a draft
// as sent records the message (and schedules a follow-up), and reminders can be
// added or deleted. This tiny external store makes those changes reflect live
// across every client surface (cards, detail modal, list pages). Phase 3
// replaces the reads/writes with Server Actions against Postgres.

import { useSyncExternalStore } from "react";
import { mockOutreach, mockReminders } from "@/lib/mock-data";
import type { OutreachMessage, Reminder } from "@/lib/types";

let outreach: OutreachMessage[] = [...mockOutreach];
let reminders: Reminder[] = [...mockReminders];

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/* ---- mutations ---- */

export function addOutreach(message: OutreachMessage) {
  outreach = [message, ...outreach];
  emit();
}

export function addReminder(reminder: Reminder) {
  reminders = [reminder, ...reminders];
  emit();
}

export function deleteReminder(id: string) {
  reminders = reminders.filter((r) => r.id !== id);
  emit();
}

/** Next sequence number for a lead's auto/manual reminders. */
export function nextReminderSequence(leadId: string): number {
  const n = reminders.filter((r) => r.leadId === leadId).length;
  return n + 1;
}

/* ---- reads (stable snapshots for useSyncExternalStore) ---- */

const getOutreach = () => outreach;
const getReminders = () => reminders;

export function useOutreach(): OutreachMessage[] {
  return useSyncExternalStore(subscribe, getOutreach, getOutreach);
}

export function useReminders(): Reminder[] {
  return useSyncExternalStore(subscribe, getReminders, getReminders);
}

export function useOutreachForLead(leadId: string): OutreachMessage[] {
  return useOutreach().filter((m) => m.leadId === leadId);
}

export function useRemindersForLead(leadId: string): Reminder[] {
  return useReminders().filter((r) => r.leadId === leadId);
}
