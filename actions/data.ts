"use server";

// Server Actions — the DB-backed replacement for the client mock-store's
// mutations. All business logic and cascades (jobs ↔ reminders ↔ tasks) live
// here now; the client store just calls these and re-reads the workspace.
//
// Every write is scoped to the current user (getCurrentUserId) and, where it
// touches multiple rows, wrapped in a transaction.

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/current-user";
import { deleteLeadsSchema, parseInput } from "@/lib/schemas";
import { loadWorkspace, type WorkspaceData } from "@/lib/queries";
import {
  contacts as contactsT,
  jobLeads as leadsT,
  outreachMessages as outreachT,
  reminders as remindersT,
  tasks as tasksT,
  userSettings as settingsT,
} from "@/db/schema";
import { isJobOpen } from "@/lib/types";
import type {
  CloseOutcome,
  ConnectionType,
  LeadStatus,
  OutreachKind,
  ReminderOutcome,
} from "@/lib/types";

/** Read the whole workspace for the current user (used to refresh the store). */
export async function getWorkspace(): Promise<WorkspaceData> {
  return loadWorkspace(await getCurrentUserId());
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/* ---------------- leads ---------------- */

export async function setLeadStatusAction(
  leadId: string,
  status: LeadStatus,
  closeOutcome: CloseOutcome | null = null,
) {
  const userId = await getCurrentUserId();
  await db.transaction(async (tx) => {
    await tx
      .update(leadsT)
      .set({ status, closeOutcome: status === "closed" ? closeOutcome : null })
      .where(and(eq(leadsT.id, leadId), eq(leadsT.userId, userId)));
    // Terminal → cancel pending reminders + open tasks for this job.
    if (!isJobOpen(status)) {
      await tx
        .update(remindersT)
        .set({ outcome: "closed" })
        .where(
          and(
            eq(remindersT.leadId, leadId),
            eq(remindersT.userId, userId),
            eq(remindersT.outcome, "pending"),
          ),
        );
      await tx
        .update(tasksT)
        .set({ status: "done", completedAt: new Date() })
        .where(
          and(
            eq(tasksT.jobId, leadId),
            eq(tasksT.userId, userId),
            eq(tasksT.status, "open"),
          ),
        );
    }
  });
}

/**
 * Permanently delete leads (used by the Archive trash). All children — details,
 * contacts, outreach, reminders, tasks — are removed by the ON DELETE CASCADE
 * foreign keys, so deleting the lead rows is enough. Scoped to the current user.
 */
export async function deleteLeadsAction(ids: string[]) {
  const userId = await getCurrentUserId();
  const clean = parseInput(deleteLeadsSchema, ids);
  await db
    .delete(leadsT)
    .where(and(eq(leadsT.userId, userId), inArray(leadsT.id, clean)));
}

/* ---------------- contacts ---------------- */

export async function addContactAction(input: {
  leadId: string;
  name: string;
  title: string;
  linkedinUrl: string;
  connectionType: ConnectionType;
  aiParsed: boolean;
}) {
  const userId = await getCurrentUserId();
  await db.insert(contactsT).values({
    userId,
    leadId: input.leadId,
    name: input.name,
    title: input.title,
    linkedinUrl: input.linkedinUrl || null,
    connectionType: input.connectionType,
    aiParsed: input.aiParsed,
  });
}

export async function updateContactAction(
  id: string,
  patch: {
    name: string;
    title: string;
    linkedinUrl: string;
    connectionType: ConnectionType;
  },
) {
  const userId = await getCurrentUserId();
  await db
    .update(contactsT)
    .set({
      name: patch.name,
      title: patch.title,
      linkedinUrl: patch.linkedinUrl || null,
      connectionType: patch.connectionType,
    })
    .where(and(eq(contactsT.id, id), eq(contactsT.userId, userId)));
}

export async function deleteContactAction(id: string) {
  const userId = await getCurrentUserId();
  await db
    .delete(contactsT)
    .where(and(eq(contactsT.id, id), eq(contactsT.userId, userId)));
}

/* ---------------- outreach: mark sent (+ schedule reminder + task) ---------- */

export async function markSentAction(input: {
  leadId: string;
  contactId: string;
  kind: OutreachKind;
  channel: string;
  draftBody: string;
}) {
  const userId = await getCurrentUserId();
  await db.transaction(async (tx) => {
    const now = new Date();
    // Follow-up interval comes from the user's saved settings (FR-5.1).
    const [settings] = await tx
      .select({ interval: settingsT.reminderIntervalDays })
      .from(settingsT)
      .where(eq(settingsT.userId, userId));
    const intervalDays = settings?.interval ?? 3;
    // Record the sent message. resumeId is left null until resumes are
    // DB-backed (a later milestone) — avoids an FK error on mock resume ids.
    await tx.insert(outreachT).values({
      userId,
      leadId: input.leadId,
      contactId: input.contactId,
      kind: input.kind,
      channel: input.channel,
      status: "sent",
      draftBody: input.draftBody,
      sentBody: input.draftBody,
      resumeId: null,
      createdAt: now,
      sentAt: now,
    });

    const [lead] = await tx
      .select({ company: leadsT.company })
      .from(leadsT)
      .where(and(eq(leadsT.id, input.leadId), eq(leadsT.userId, userId)));

    const seq = await nextSequence(tx, userId, input.leadId);
    const due = new Date();
    due.setDate(due.getDate() + intervalDays);
    const dueDate = ymd(due);

    const [rem] = await tx
      .insert(remindersT)
      .values({
        userId,
        leadId: input.leadId,
        outreachMessageId: null,
        sequence: seq,
        dueDate,
        outcome: "pending",
        manual: false,
      })
      .returning({ id: remindersT.id });

    await tx.insert(tasksT).values({
      userId,
      jobId: input.leadId,
      reminderId: rem.id,
      title: `Follow up — ${lead?.company ?? "lead"}`,
      kind: "follow-up",
      dueDate,
      status: "open",
    });
  });
}

/* ---------------- reminders ---------------- */

async function nextSequence(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  leadId: string,
): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(remindersT)
    .where(and(eq(remindersT.leadId, leadId), eq(remindersT.userId, userId)));
  return (row?.n ?? 0) + 1;
}

export async function addReminderManualAction(input: {
  leadId: string;
  dueDate: string; // YYYY-MM-DD
  label: string;
  outreachMessageId: string | null;
}) {
  const userId = await getCurrentUserId();
  await db.transaction(async (tx) => {
    const [lead] = await tx
      .select({ company: leadsT.company })
      .from(leadsT)
      .where(and(eq(leadsT.id, input.leadId), eq(leadsT.userId, userId)));
    const seq = await nextSequence(tx, userId, input.leadId);
    const [rem] = await tx
      .insert(remindersT)
      .values({
        userId,
        leadId: input.leadId,
        outreachMessageId: input.outreachMessageId,
        sequence: seq,
        dueDate: input.dueDate,
        outcome: "pending",
        manual: true,
        label: input.label || null,
      })
      .returning({ id: remindersT.id });
    await tx.insert(tasksT).values({
      userId,
      jobId: input.leadId,
      reminderId: rem.id,
      title: input.label || `Follow up — ${lead?.company ?? "lead"}`,
      kind: "follow-up",
      dueDate: input.dueDate,
      status: "open",
    });
  });
}

export async function setReminderOutcomeAction(
  id: string,
  outcome: ReminderOutcome,
) {
  const userId = await getCurrentUserId();
  const done = outcome !== "pending";
  await db.transaction(async (tx) => {
    await tx
      .update(remindersT)
      .set({ outcome })
      .where(and(eq(remindersT.id, id), eq(remindersT.userId, userId)));
    await tx
      .update(tasksT)
      .set({
        status: done ? "done" : "open",
        completedAt: done ? new Date() : null,
      })
      .where(and(eq(tasksT.reminderId, id), eq(tasksT.userId, userId)));
  });
}

export async function snoozeReminderAction(id: string, newDueDate: string) {
  const userId = await getCurrentUserId();
  await db.transaction(async (tx) => {
    await tx
      .update(remindersT)
      .set({ outcome: "pending", dueDate: newDueDate })
      .where(and(eq(remindersT.id, id), eq(remindersT.userId, userId)));
    await tx
      .update(tasksT)
      .set({ status: "open", completedAt: null, dueDate: newDueDate })
      .where(and(eq(tasksT.reminderId, id), eq(tasksT.userId, userId)));
  });
}

export async function deleteReminderAction(id: string) {
  const userId = await getCurrentUserId();
  await db.transaction(async (tx) => {
    await tx
      .delete(tasksT)
      .where(and(eq(tasksT.reminderId, id), eq(tasksT.userId, userId)));
    await tx
      .delete(remindersT)
      .where(and(eq(remindersT.id, id), eq(remindersT.userId, userId)));
  });
}

/* ---------------- tasks ---------------- */

export async function completeTaskAction(id: string) {
  const userId = await getCurrentUserId();
  await db.transaction(async (tx) => {
    const [task] = await tx
      .select({ reminderId: tasksT.reminderId })
      .from(tasksT)
      .where(and(eq(tasksT.id, id), eq(tasksT.userId, userId)));
    await tx
      .update(tasksT)
      .set({ status: "done", completedAt: new Date() })
      .where(and(eq(tasksT.id, id), eq(tasksT.userId, userId)));
    if (task?.reminderId) {
      await tx
        .update(remindersT)
        .set({ outcome: "closed" })
        .where(
          and(
            eq(remindersT.id, task.reminderId),
            eq(remindersT.userId, userId),
          ),
        );
    }
  });
}
