"use server";

// Server Actions — the DB-backed replacement for the client mock-store's
// mutations. All business logic and cascades (jobs ↔ reminders ↔ tasks) live
// here now; the client store just calls these and re-reads the workspace.
//
// Every write is scoped to the current user (getCurrentUserId) and, where it
// touches multiple rows, wrapped in a transaction.

import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/current-user";
import {
  createLeadSchema,
  deleteLeadsSchema,
  parseInput,
  type CreateLeadInput,
} from "@/lib/schemas";
import { extractLinkedInJobId } from "@/lib/linkedin-parser";
import { loadWorkspace, type WorkspaceData } from "@/lib/queries";
import {
  contacts as contactsT,
  jobLeads as leadsT,
  jobLeadDetails as detailsT,
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

/**
 * Manually create a lead (the "Add lead" modal), with an optional inline
 * contact. Derives the fields the form doesn't ask for:
 *  - linkedinJobId: parsed from the job URL when it's a LinkedIn link, else a
 *    synthetic `manual-<uuid>` so manual leads never collide on the
 *    UNIQUE(user, linkedin_job_id) dedupe key.
 *  - postedRelative: "just now" (there's no real posting age for a manual add).
 *  - capturedAt / status default handled by the column / schema.
 *
 * Returns a discriminated result so the dialog can show inline errors
 * (validation or a duplicate) instead of throwing.
 */
export async function createLeadAction(input: {
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
  const userId = await getCurrentUserId();

  let data: CreateLeadInput;
  try {
    data = parseInput(createLeadSchema, input);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid input." };
  }

  // A LinkedIn URL gives us the real dedupe key; anything else is synthetic.
  const linkedinJobId =
    (data.jobUrl && extractLinkedInJobId(data.jobUrl)) || `manual-${randomUUID()}`;

  try {
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(leadsT)
        .values({
          userId,
          linkedinJobId,
          title: data.title,
          company: data.company,
          location: data.location,
          remote: data.remote,
          tags: data.tags,
          postedRelative: "just now",
          canonicalJobUrl: data.jobUrl,
          status: data.status as LeadStatus,
        })
        .returning({ id: leadsT.id });

      const leadId = row.id;

      // Detail row only when there's something to store.
      if (data.jdText || data.notes) {
        await tx.insert(detailsT).values({
          leadId,
          userId,
          jdText: data.jdText || null,
          notes: data.notes || null,
        });
      }

      if (data.contact) {
        await tx.insert(contactsT).values({
          userId,
          leadId,
          name: data.contact.name,
          title: data.contact.title,
          linkedinUrl: data.contact.linkedinUrl || null,
          connectionType: data.contact.connectionType as ConnectionType,
          aiParsed: false,
        });
      }

      return leadId;
    });
    return { ok: true, id };
  } catch (e) {
    const code = (e as { code?: string })?.code;
    const msg = e instanceof Error ? e.message : String(e);
    if (code === "23505" || msg.includes("job_leads_user_linkedin_job_id_uq")) {
      return {
        ok: false,
        error: "This job looks like it's already in your leads.",
      };
    }
    return { ok: false, error: "Couldn't save the lead. Please try again." };
  }
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
    const [msg] = await tx
      .insert(outreachT)
      .values({
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
      })
      .returning({ id: outreachT.id });

    const [lead] = await tx
      .select({ company: leadsT.company })
      .from(leadsT)
      .where(and(eq(leadsT.id, input.leadId), eq(leadsT.userId, userId)));

    const seq = await nextSequence(tx, userId, input.leadId);
    // Schedule intervalDays ahead, keeping the current time of day.
    const due = new Date();
    due.setDate(due.getDate() + intervalDays);
    const dueAt = due.toISOString();
    const dueDay = ymd(due);

    const [rem] = await tx
      .insert(remindersT)
      .values({
        userId,
        leadId: input.leadId,
        // Link the reminder to the message it follows up, so we can explain why
        // it exists ("Follow-up on your … to …").
        outreachMessageId: msg.id,
        sequence: seq,
        dueDate: dueAt,
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
      dueDate: dueDay,
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
  dueDate: string; // ISO datetime
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
      dueDate: input.dueDate.slice(0, 10), // task board is day-granular
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
      .set({ status: "open", completedAt: null, dueDate: newDueDate.slice(0, 10) })
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
