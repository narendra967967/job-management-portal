"use server";

// Server Actions — the DB-backed replacement for the client mock-store's
// mutations. All business logic and cascades (jobs ↔ reminders ↔ tasks) live
// here now; the client store just calls these and re-reads the workspace.
//
// Every write is scoped to the current user (getCurrentUserId) and, where it
// touches multiple rows, wrapped in a transaction.

import { isUniqueViolation } from "@/lib/db-errors";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/current-user";
import {
  addContactSchema,
  addReminderSchema,
  createLeadSchema,
  editLeadSchema,
  deleteLeadsSchema,
  leadStatusSchema,
  markSentSchema,
  parseInput,
  reminderOutcomeSchema,
  snoozeReminderSchema,
  topChoiceSchema,
  updateContactSchema,
  zId,
  type CreateLeadInput,
  type EditLeadInput,
} from "@/lib/schemas";
import { jobKeyForUrl } from "@/lib/job-key";
import { sourceFromUrl } from "@/lib/lead-source";
import {
  advanceLeadStatus,
  pipelineRank,
  type AutoStatusChange,
} from "@/lib/auto-status";
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

/**
 * The calendar day ("YYYY-MM-DD") `d` falls on in `timeZone` — the viewer's
 * zone, sent by the client. Task due dates are day-granular and compared
 * against the viewer's local "today", so they must not be the UTC day.
 */
function localDay(d: Date | string, timeZone: string): string {
  // A bare date is already a calendar day (and would parse as UTC midnight).
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(d));
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Throw unless every referenced row belongs to `userId`. Inserts below carry
 * the caller's user_id, but the FKs alone would still let a crafted request
 * hang rows off SOMEONE ELSE's lead/contact/message — so check ownership first.
 */
async function assertOwned(
  tx: Tx | typeof db,
  userId: string,
  refs: { leadId?: string; contactId?: string; outreachMessageId?: string | null },
) {
  if (refs.leadId) {
    const [r] = await tx
      .select({ id: leadsT.id })
      .from(leadsT)
      .where(and(eq(leadsT.id, refs.leadId), eq(leadsT.userId, userId)));
    if (!r) throw new Error("Lead not found.");
  }
  if (refs.contactId) {
    const [r] = await tx
      .select({ id: contactsT.id })
      .from(contactsT)
      .where(
        and(
          eq(contactsT.id, refs.contactId),
          eq(contactsT.userId, userId),
          ...(refs.leadId ? [eq(contactsT.leadId, refs.leadId)] : []),
        ),
      );
    if (!r) throw new Error("Contact not found.");
  }
  if (refs.outreachMessageId) {
    const [r] = await tx
      .select({ id: outreachT.id })
      .from(outreachT)
      .where(
        and(eq(outreachT.id, refs.outreachMessageId), eq(outreachT.userId, userId)),
      );
    if (!r) throw new Error("Message not found.");
  }
}

/* ---------------- leads ---------------- */

export async function setLeadStatusAction(
  leadId: string,
  status: LeadStatus,
  closeOutcome: CloseOutcome | null = null,
) {
  const userId = await getCurrentUserId();
  const input = parseInput(leadStatusSchema, { leadId, status, closeOutcome });
  const next = input.status as LeadStatus;
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: leadsT.status })
      .from(leadsT)
      .where(and(eq(leadsT.id, input.leadId), eq(leadsT.userId, userId)));
    if (!current) throw new Error("Lead not found.");
    // A deliberate move BACKWARDS in the open pipeline pins the lead so the
    // automatic status rules leave it alone; any other manual move unpins it.
    const fromRank = pipelineRank(current.status);
    const toRank = pipelineRank(next);
    const statusPinned = fromRank >= 0 && toRank >= 0 && toRank < fromRank;
    const [row] = await tx
      .update(leadsT)
      .set({
        status: next,
        statusPinned,
        closeOutcome:
          next === "closed" ? ((input.closeOutcome as CloseOutcome | null) ?? null) : null,
      })
      .where(and(eq(leadsT.id, input.leadId), eq(leadsT.userId, userId)))
      .returning({ id: leadsT.id });
    if (!row) throw new Error("Lead not found.");
    // Terminal → cancel pending reminders + open tasks for this job.
    if (!isJobOpen(next)) {
      await tx
        .update(remindersT)
        .set({ outcome: "closed" })
        .where(
          and(
            eq(remindersT.leadId, input.leadId),
            eq(remindersT.userId, userId),
            eq(remindersT.outcome, "pending"),
          ),
        );
      await tx
        .update(tasksT)
        .set({ status: "done", completedAt: new Date() })
        .where(
          and(
            eq(tasksT.jobId, input.leadId),
            eq(tasksT.userId, userId),
            eq(tasksT.status, "open"),
          ),
        );
    }
  });
}

/** Star / unstar a lead as a Top Choice. Scoped to the current user. */
export async function setLeadTopChoiceAction(
  leadId: string,
  topChoice: boolean,
): Promise<{ autoStatus: AutoStatusChange | null }> {
  const userId = await getCurrentUserId();
  const input = parseInput(topChoiceSchema, { leadId, topChoice });
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(leadsT)
      .set({ topChoice: input.topChoice })
      .where(and(eq(leadsT.id, input.leadId), eq(leadsT.userId, userId)))
      .returning({ id: leadsT.id });
    if (!row) throw new Error("Lead not found.");
    // Starring a lead means you're interested → Shortlisted.
    const autoStatus = input.topChoice
      ? await advanceLeadStatus(tx, userId, input.leadId, "shortlisted")
      : null;
    return { autoStatus };
  });
}

/**
 * Undo an automatic status change (the toast's Undo). Only reverts if the lead
 * is still in the status automation moved it to, and doesn't pin it.
 */
export async function undoAutoStatusAction(
  leadId: string,
  from: LeadStatus,
  to: LeadStatus,
): Promise<void> {
  const userId = await getCurrentUserId();
  const a = parseInput(leadStatusSchema, { leadId, status: from, closeOutcome: null });
  const b = parseInput(leadStatusSchema, { leadId, status: to, closeOutcome: null });
  await db
    .update(leadsT)
    .set({ status: a.status as LeadStatus })
    .where(
      and(
        eq(leadsT.id, a.leadId),
        eq(leadsT.userId, userId),
        eq(leadsT.status, b.status as LeadStatus),
      ),
    );
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
 * Stable per-user dedupe key for a job URL — the same key the email readers
 * build (lib/job-key.ts), so a manual add collides with the same job captured
 * from an alert. Uniqueness is scoped per user by the DB constraint.
 */
function dedupeKeyForUrl(rawUrl: string): string {
  return jobKeyForUrl(rawUrl);
}

/**
 * Manually create a lead (the "Add lead" modal), with an optional inline
 * contact. Derives the fields the form doesn't ask for:
 *  - linkedinJobId (the dedupe key): from the job URL when one is given
 *    (LinkedIn id, else normalized URL) so the same link can't be added twice
 *    by one user; a lead with no URL gets a synthetic `manual-<uuid>` and is
 *    always allowed (there's nothing to match on).
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
  topChoice?: boolean;
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

  // The job URL (required) is the per-user dedupe key.
  const linkedinJobId = dedupeKeyForUrl(data.jobUrl);

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
          source: sourceFromUrl(data.jobUrl),
          origin: "manual",
          topChoice: data.topChoice,
        })
        .returning({ id: leadsT.id });

      const leadId = row.id;

      // Detail row only when there's something to store.
      if (data.jdText) {
        await tx.insert(detailsT).values({ leadId, userId, jdText: data.jdText });
      }

      // Same rule as starring an existing lead: Top Choice → Shortlisted
      // (forward-only; respects the user's automatic-status setting).
      if (data.topChoice) {
        await advanceLeadStatus(tx, userId, leadId, "shortlisted");
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
    if (isUniqueViolation(e)) {
      return {
        ok: false,
        error: "This job is already in your leads — search for it on the Leads page.",
      };
    }
    console.error("[leads] create failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "Couldn't save the lead. Please try again." };
  }
}

/**
 * Edit a lead's core fields (title/company/location/remote/jobUrl/tags/status)
 * and its job description. Changing the URL recomputes the per-user dedupe key, so a
 * URL that collides with another of the user's leads is rejected (repetition
 * avoided). Scoped to the current user; returns a friendly result.
 */
export async function updateLeadAction(
  leadId: string,
  input: EditLeadInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await getCurrentUserId();

  let data: EditLeadInput;
  try {
    data = parseInput(editLeadSchema, input);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid input." };
  }

  const linkedinJobId = dedupeKeyForUrl(data.jobUrl);

  try {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(leadsT)
        .set({
          title: data.title,
          company: data.company,
          location: data.location,
          remote: data.remote,
          tags: data.tags,
          canonicalJobUrl: data.jobUrl,
          linkedinJobId,
          // The URL may have changed platform; origin (system/manual) never changes.
          source: sourceFromUrl(data.jobUrl),
          // status is intentionally not edited here (managed by the status control).
        })
        .where(and(eq(leadsT.id, leadId), eq(leadsT.userId, userId)))
        .returning({ id: leadsT.id });

      if (!row) throw new Error("LEAD_NOT_FOUND");

      // Upsert the detail row for the JD.
      await tx
        .insert(detailsT)
        .values({ leadId, userId, jdText: data.jdText || null })
        .onConflictDoUpdate({
          target: detailsT.leadId,
          set: { jdText: data.jdText || null },
        });
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "LEAD_NOT_FOUND") {
      return { ok: false, error: "Lead not found." };
    }
    if (isUniqueViolation(e)) {
      return {
        ok: false,
        error: "That job URL is already used by another of your leads.",
      };
    }
    return { ok: false, error: "Couldn't update the lead. Please try again." };
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
  const data = parseInput(addContactSchema, input);
  return db.transaction(async (tx) => {
    await assertOwned(tx, userId, { leadId: data.leadId });
    await tx.insert(contactsT).values({
      userId,
      leadId: data.leadId,
      name: data.name,
      title: data.title,
      linkedinUrl: data.linkedinUrl || null,
      connectionType: data.connectionType as ConnectionType,
      aiParsed: data.aiParsed,
    });
    // Finding a recruiter / referral means you're working this job.
    const autoStatus = await advanceLeadStatus(tx, userId, data.leadId, "shortlisted");
    return { autoStatus };
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
  const contactId = parseInput(zId, id);
  const data = parseInput(updateContactSchema, patch);
  await db
    .update(contactsT)
    .set({
      name: data.name,
      title: data.title,
      linkedinUrl: data.linkedinUrl || null,
      connectionType: data.connectionType as ConnectionType,
    })
    .where(and(eq(contactsT.id, contactId), eq(contactsT.userId, userId)));
}

export async function deleteContactAction(id: string) {
  const userId = await getCurrentUserId();
  const contactId = parseInput(zId, id);
  await db
    .delete(contactsT)
    .where(and(eq(contactsT.id, contactId), eq(contactsT.userId, userId)));
}

/* ---------------- outreach: mark sent (+ schedule reminder + task) ---------- */

export async function markSentAction(input: {
  leadId: string;
  contactId: string;
  kind: OutreachKind;
  channel: string;
  draftBody: string;
  timeZone?: string;
}): Promise<{ autoStatus: AutoStatusChange | null }> {
  const userId = await getCurrentUserId();
  const data = parseInput(markSentSchema, input);
  return db.transaction(async (tx) => {
    // The contact must be the user's AND belong to this lead.
    await assertOwned(tx, userId, { leadId: data.leadId, contactId: data.contactId });
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
        leadId: data.leadId,
        contactId: data.contactId,
        kind: data.kind as OutreachKind,
        channel: data.channel,
        status: "sent",
        draftBody: data.draftBody,
        sentBody: data.draftBody,
        resumeId: null,
        createdAt: now,
        sentAt: now,
      })
      .returning({ id: outreachT.id });

    const [lead] = await tx
      .select({ company: leadsT.company })
      .from(leadsT)
      .where(and(eq(leadsT.id, data.leadId), eq(leadsT.userId, userId)));

    const seq = await nextSequence(tx, userId, data.leadId);
    // Schedule intervalDays ahead, keeping the current time of day.
    const due = new Date();
    due.setDate(due.getDate() + intervalDays);
    const dueAt = due.toISOString();
    const dueDay = localDay(due, data.timeZone);

    const [rem] = await tx
      .insert(remindersT)
      .values({
        userId,
        leadId: data.leadId,
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
      jobId: data.leadId,
      reminderId: rem.id,
      title: `Follow up — ${lead?.company ?? "lead"}`,
      kind: "follow-up",
      dueDate: dueDay,
      status: "open",
    });

    // A referral ask comes before applying (→ Shortlisted); cold outreach or a
    // follow-up means you've applied (→ Applied).
    const autoStatus = await advanceLeadStatus(
      tx,
      userId,
      data.leadId,
      data.kind === "referral-ask" ? "shortlisted" : "applied",
    );
    return { autoStatus };
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
  timeZone?: string;
}) {
  const userId = await getCurrentUserId();
  const data = parseInput(addReminderSchema, input);
  await db.transaction(async (tx) => {
    await assertOwned(tx, userId, {
      leadId: data.leadId,
      outreachMessageId: data.outreachMessageId,
    });
    const [lead] = await tx
      .select({ company: leadsT.company })
      .from(leadsT)
      .where(and(eq(leadsT.id, data.leadId), eq(leadsT.userId, userId)));
    const seq = await nextSequence(tx, userId, data.leadId);
    const [rem] = await tx
      .insert(remindersT)
      .values({
        userId,
        leadId: data.leadId,
        outreachMessageId: data.outreachMessageId,
        sequence: seq,
        dueDate: data.dueDate,
        outcome: "pending",
        manual: true,
        label: data.label || null,
      })
      .returning({ id: remindersT.id });
    await tx.insert(tasksT).values({
      userId,
      jobId: data.leadId,
      reminderId: rem.id,
      title: data.label || `Follow up — ${lead?.company ?? "lead"}`,
      kind: "follow-up",
      dueDate: localDay(data.dueDate, data.timeZone), // task board is day-granular
      status: "open",
    });
  });
}

export async function setReminderOutcomeAction(
  id: string,
  outcome: ReminderOutcome,
  timeZone?: string,
): Promise<{ nextFollowUp: { dueDate: string; number: number } | null }> {
  const userId = await getCurrentUserId();
  const data = parseInput(reminderOutcomeSchema, { id, outcome, timeZone });
  const next = data.outcome as ReminderOutcome;
  const done = next !== "pending";
  return db.transaction(async (tx) => {
    await tx
      .update(remindersT)
      .set({ outcome: next })
      .where(and(eq(remindersT.id, data.id), eq(remindersT.userId, userId)));
    await tx
      .update(tasksT)
      .set({
        status: done ? "done" : "open",
        completedAt: done ? new Date() : null,
      })
      .where(and(eq(tasksT.reminderId, data.id), eq(tasksT.userId, userId)));
    // You sent the follow-up → line up the next one (FR-5.4).
    const nextFollowUp =
      next === "reminder-sent"
        ? await scheduleNextFollowUp(tx, userId, data.id, data.timeZone)
        : null;
    return { nextFollowUp };
  });
}

/**
 * Automatic follow-up chain (FR-5.4). When a follow-up reminder tied to a sent
 * message is marked "Reminder sent", schedule the next one after the user's
 * reminder interval — up to `max_follow_ups` beyond the first. The chain stops
 * on its own when the job is no longer open, and any other outcome
 * ("Response received", "Not responded", "Closed") simply doesn't continue it.
 * Idempotent: if a later reminder already exists in the chain, nothing is added.
 */
async function scheduleNextFollowUp(
  tx: Tx,
  userId: string,
  reminderId: string,
  timeZone: string,
): Promise<{ dueDate: string; number: number } | null> {
  const [rem] = await tx
    .select({
      leadId: remindersT.leadId,
      outreachMessageId: remindersT.outreachMessageId,
      sequence: remindersT.sequence,
    })
    .from(remindersT)
    .where(and(eq(remindersT.id, reminderId), eq(remindersT.userId, userId)));
  // Only real follow-ups (tied to a message you sent) form a chain.
  if (!rem?.outreachMessageId) return null;

  const [lead] = await tx
    .select({ status: leadsT.status, company: leadsT.company })
    .from(leadsT)
    .where(and(eq(leadsT.id, rem.leadId), eq(leadsT.userId, userId)));
  if (!lead || !isJobOpen(lead.status)) return null;

  const [settings] = await tx
    .select({
      interval: settingsT.reminderIntervalDays,
      maxFollowUps: settingsT.maxFollowUps,
    })
    .from(settingsT)
    .where(eq(settingsT.userId, userId));
  const intervalDays = settings?.interval ?? 3;
  const maxFollowUps = settings?.maxFollowUps ?? 2;

  const chain = await tx
    .select({ sequence: remindersT.sequence })
    .from(remindersT)
    .where(
      and(
        eq(remindersT.userId, userId),
        eq(remindersT.leadId, rem.leadId),
        eq(remindersT.outreachMessageId, rem.outreachMessageId),
      ),
    );
  if (chain.some((r) => r.sequence > rem.sequence)) return null; // already lined up
  if (chain.length >= 1 + maxFollowUps) return null; // chain is complete

  const number = chain.length + 1;
  const due = new Date();
  due.setDate(due.getDate() + intervalDays);
  const dueAt = due.toISOString();

  const [created] = await tx
    .insert(remindersT)
    .values({
      userId,
      leadId: rem.leadId,
      outreachMessageId: rem.outreachMessageId,
      sequence: await nextSequence(tx, userId, rem.leadId),
      dueDate: dueAt,
      outcome: "pending",
      manual: false,
      label: `Follow-up ${number}`,
    })
    .returning({ id: remindersT.id });
  await tx.insert(tasksT).values({
    userId,
    jobId: rem.leadId,
    reminderId: created.id,
    title: `Follow up #${number} — ${lead.company}`,
    kind: "follow-up",
    dueDate: localDay(due, timeZone),
    status: "open",
  });
  return { dueDate: dueAt, number };
}

export async function snoozeReminderAction(
  id: string,
  newDueDate: string,
  timeZone?: string,
) {
  const userId = await getCurrentUserId();
  const data = parseInput(snoozeReminderSchema, { id, newDueDate, timeZone });
  await db.transaction(async (tx) => {
    await tx
      .update(remindersT)
      .set({ outcome: "pending", dueDate: data.newDueDate })
      .where(and(eq(remindersT.id, data.id), eq(remindersT.userId, userId)));
    await tx
      .update(tasksT)
      .set({
        status: "open",
        completedAt: null,
        dueDate: localDay(data.newDueDate, data.timeZone),
      })
      .where(and(eq(tasksT.reminderId, data.id), eq(tasksT.userId, userId)));
  });
}

export async function deleteReminderAction(id: string) {
  const userId = await getCurrentUserId();
  const reminderId = parseInput(zId, id);
  await db.transaction(async (tx) => {
    await tx
      .delete(tasksT)
      .where(and(eq(tasksT.reminderId, reminderId), eq(tasksT.userId, userId)));
    await tx
      .delete(remindersT)
      .where(and(eq(remindersT.id, reminderId), eq(remindersT.userId, userId)));
  });
}

/* ---------------- tasks ---------------- */

export async function completeTaskAction(id: string) {
  const userId = await getCurrentUserId();
  const taskId = parseInput(zId, id);
  await db.transaction(async (tx) => {
    const [task] = await tx
      .select({ reminderId: tasksT.reminderId })
      .from(tasksT)
      .where(and(eq(tasksT.id, taskId), eq(tasksT.userId, userId)));
    await tx
      .update(tasksT)
      .set({ status: "done", completedAt: new Date() })
      .where(and(eq(tasksT.id, taskId), eq(tasksT.userId, userId)));
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
