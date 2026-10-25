"use server";

// Settings → Account → Reset leads. Irreversible: deletes every lead and all
// that hangs off one, so the user can start a fresh job search. Confirmed by
// typing RESET and an emailed code (lib/action-codes.ts). Everything else —
// account, profile, career profile, résumés, settings, forwarding address,
// notes, tickets, email log and the "already read" email memory — stays.

import { and, asc, count, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/current-user";
import {
  contacts,
  gmailIngestErrors,
  inboundAiQueue,
  jobLeadDetails,
  jobLeads,
  leadPurgeLog,
  notifications,
  outreachMessages,
  reminders,
  tasks,
} from "@/db/schema";
import { issueActionCode, verifyActionCode } from "@/lib/action-codes";
import { sendAppEmail } from "@/lib/email";

export interface ResetSummary {
  leads: number;
  contacts: number;
  outreach: number;
  reminders: number;
  tasks: number;
}

async function me() {
  const u = await getSessionUser();
  if (!u) throw new Error("Please sign in again.");
  return u;
}

/** What a reset would delete, for the confirmation modal. */
export async function getResetSummaryAction(): Promise<ResetSummary> {
  const { id } = await me();
  const n = async (t: typeof jobLeads | typeof contacts | typeof outreachMessages | typeof reminders | typeof tasks) =>
    Number((await db.select({ n: count() }).from(t).where(eq(t.userId, id)))[0]?.n ?? 0);
  const [leads, c, o, r, t] = await Promise.all([n(jobLeads), n(contacts), n(outreachMessages), n(reminders), n(tasks)]);
  return { leads, contacts: c, outreach: o, reminders: r, tasks: t };
}

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** All the user's leads as CSV — the backup offered before a reset. */
export async function exportLeadsCsvAction(): Promise<{ filename: string; csv: string }> {
  const { id } = await me();
  const leads = await db
    .select({
      id: jobLeads.id,
      title: jobLeads.title,
      company: jobLeads.company,
      location: jobLeads.location,
      remote: jobLeads.remote,
      status: jobLeads.status,
      topChoice: jobLeads.topChoice,
      source: jobLeads.source,
      url: jobLeads.canonicalJobUrl,
      tags: jobLeads.tags,
      createdAt: jobLeads.createdAt,
      jd: jobLeadDetails.jdText,
      notes: jobLeadDetails.notes,
    })
    .from(jobLeads)
    .leftJoin(jobLeadDetails, eq(jobLeadDetails.leadId, jobLeads.id))
    .where(eq(jobLeads.userId, id))
    .orderBy(asc(jobLeads.createdAt));
  const people = leads.length
    ? await db
        .select({ leadId: contacts.leadId, name: contacts.name, title: contacts.title, url: contacts.linkedinUrl })
        .from(contacts)
        .where(and(eq(contacts.userId, id), inArray(contacts.leadId, leads.map((l) => l.id))))
    : [];
  const byLead = new Map<string, string[]>();
  for (const p of people) {
    const s = [p.name, p.title, p.url].filter(Boolean).join(" — ");
    byLead.set(p.leadId, [...(byLead.get(p.leadId) ?? []), s]);
  }

  const header = ["Title", "Company", "Location", "Remote", "Status", "Top choice", "Source", "Job URL", "Tags", "Added", "Contacts", "Notes", "Job description"];
  const lines = [header.join(",")];
  for (const l of leads) {
    lines.push(
      [
        l.title,
        l.company,
        l.location,
        l.remote ? "Yes" : "No",
        l.status,
        l.topChoice ? "Yes" : "No",
        l.source,
        l.url,
        l.tags.join("; "),
        l.createdAt.toISOString().slice(0, 10),
        (byLead.get(l.id) ?? []).join("; "),
        l.notes ?? "",
        l.jd ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  // BOM so Excel opens UTF-8 (₹, é…) correctly.
  return { filename: `leads-${new Date().toISOString().slice(0, 10)}.csv`, csv: "﻿" + lines.join("\r\n") };
}

/** Step 2: the user typed RESET — email them a code. */
export async function sendResetCodeAction(confirmText: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const u = await me();
  if (confirmText !== "RESET") return { ok: false, error: "Type RESET in capitals to continue." };
  return issueActionCode(u.id, u.email, "reset_leads");
}

/** Step 3: correct code → delete everything lead-related in one transaction. */
export async function resetLeadsAction(code: string): Promise<{ ok: true; deleted: number } | { ok: false; error: string }> {
  const u = await me();
  if (typeof code !== "string") return { ok: false, error: "Enter the code from the email." };
  const v = await verifyActionCode(u.id, "reset_leads", code);
  if (!v.ok) return v;

  let deleted = 0;
  try {
    await db.transaction(async (tx) => {
      // Leads cascade to their details (JD, summary, salary insight), contacts,
      // outreach, reminders, to-dos and fit scores.
      const gone = await tx.delete(jobLeads).where(eq(jobLeads.userId, u.id)).returning({ id: jobLeads.id });
      deleted = gone.length;
      await tx.delete(leadPurgeLog).where(eq(leadPurgeLog.userId, u.id));
      await tx.delete(notifications).where(and(eq(notifications.userId, u.id), eq(notifications.type, "lead-purge")));
      // Emails still waiting for AI reading would turn back into leads.
      await tx.delete(inboundAiQueue).where(eq(inboundAiQueue.userId, u.id));
      await tx.delete(gmailIngestErrors).where(eq(gmailIngestErrors.userId, u.id));
    });
  } catch (e) {
    console.error("[reset-leads] failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "The reset didn't go through — nothing was deleted. Please try again." };
  }

  // Confirmation email — best effort; the reset itself is done.
  sendAppEmail({
    to: u.email,
    subject: "Your leads have been reset",
    heading: "Your leads have been reset",
    lines: [
      `We permanently deleted ${deleted} ${deleted === 1 ? "lead" : "leads"} and everything attached to them, as you asked.`,
      "Your account, profile, résumés, settings and email forwarding are unchanged — new job alerts will keep arriving as fresh leads.",
      "If you didn't do this, change your password and contact support straight away.",
    ],
  }).catch((e) => console.error("[reset-leads] confirmation email failed:", e instanceof Error ? e.message : e));

  revalidatePath("/", "layout");
  return { ok: true, deleted };
}
