import "server-only";

import { and, eq, gt, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobLeads, tasks } from "@/db/schema";
import { createNotification } from "@/lib/notifications";
import { candidateAiOpen } from "@/lib/mock-interviews/config";
import { OPEN_LEAD_STATUSES } from "@/lib/types";

// Phase 4 of docs/lead-interview-link/roadmap.md: the interview date on a lead,
// the "Practice for …" to-do and the reminder the day before. Every function
// takes the user id and scopes its reads and writes to it.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = typeof db | Tx;

const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" of an instant in a time zone. */
function dayIn(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** The practice to-do is due the day before the interview (today, if that's
 *  already gone), and has no date while the interview has none. */
export function practiceDueDay(interviewAt: Date | null, timeZone: string, now = new Date()): string | null {
  if (!interviewAt) return null;
  const dayBefore = dayIn(new Date(interviewAt.getTime() - DAY_MS), timeZone);
  const today = dayIn(now, timeZone);
  return dayBefore < today ? today : dayBefore;
}

/**
 * Item 6: when a lead reaches Interview, add "Practice for <role> at <company>"
 * to the To-do list, unless one is already open for it. Only while AI
 * interviews are open, since the to-do points at them.
 */
export async function ensurePracticeTask(userId: string, leadId: string, timeZone: string): Promise<boolean> {
  if (!(await candidateAiOpen().catch(() => false))) return false;
  const [lead] = await db
    .select({ title: jobLeads.title, company: jobLeads.company, interviewAt: jobLeads.interviewAt, status: jobLeads.status })
    .from(jobLeads)
    .where(and(eq(jobLeads.id, leadId), eq(jobLeads.userId, userId)));
  if (!lead || lead.status !== "interview") return false;
  const [open] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.jobId, leadId), eq(tasks.kind, "practice"), eq(tasks.status, "open")))
    .limit(1);
  if (open) return false;
  await db.insert(tasks).values({
    userId,
    jobId: leadId,
    title: `Practice for ${lead.title} at ${lead.company}`,
    kind: "practice",
    dueDate: practiceDueDay(lead.interviewAt, timeZone),
    status: "open",
  });
  return true;
}

/** Move the lead's open practice to-do to match a new (or removed) interview date. */
export async function syncPracticeTaskDue(tx: Db, userId: string, leadId: string, interviewAt: Date | null, timeZone: string) {
  await tx
    .update(tasks)
    .set({ dueDate: practiceDueDay(interviewAt, timeZone) })
    .where(and(eq(tasks.userId, userId), eq(tasks.jobId, leadId), eq(tasks.kind, "practice"), eq(tasks.status, "open")));
}

/** A practice for this lead got its report: its to-do is done. */
export async function closePracticeTasks(userId: string, leadId: string): Promise<void> {
  await db
    .update(tasks)
    .set({ status: "done", completedAt: new Date() })
    .where(and(eq(tasks.userId, userId), eq(tasks.jobId, leadId), eq(tasks.kind, "practice"), eq(tasks.status, "open")));
}

/**
 * Item 7: a bell notification once the interview is less than a day away, one
 * per date (changing the date clears the mark). Run by the mock interview
 * upkeep job every 5 minutes. Leads closed or discarded are skipped.
 */
export async function sendInterviewReminders(now = new Date()): Promise<number> {
  const due = await db
    .select({ id: jobLeads.id, userId: jobLeads.userId, title: jobLeads.title, company: jobLeads.company })
    .from(jobLeads)
    .where(
      and(
        isNull(jobLeads.interviewRemindedAt),
        gt(jobLeads.interviewAt, now),
        lte(jobLeads.interviewAt, new Date(now.getTime() + DAY_MS)),
        inArray(jobLeads.status, OPEN_LEAD_STATUSES),
      ),
    )
    .limit(200);
  if (!due.length) return 0;
  const practiceOpen = await candidateAiOpen().catch(() => false);
  let sent = 0;
  for (const l of due) {
    // Claim it first, so two runs never send twice.
    const claimed = await db
      .update(jobLeads)
      // Keep updated_at: a reminder isn't the user doing anything on the lead.
      .set({ interviewRemindedAt: now, updatedAt: sql`${jobLeads.updatedAt}` })
      .where(and(eq(jobLeads.id, l.id), isNull(jobLeads.interviewRemindedAt)))
      .returning({ id: jobLeads.id });
    if (!claimed.length) continue;
    await createNotification(l.userId, {
      type: "interview_soon",
      title: "Your interview is less than a day away",
      body: practiceOpen
        ? `${l.title} at ${l.company}. There's still time for a practice run: open the lead and start one.`
        : `${l.title} at ${l.company}. Open the lead to look over your notes and contacts.`,
      href: `/leads/${l.id}`,
    });
    sent++;
  }
  return sent;
}
