import "server-only";

// Turn parsed job-alert drafts into leads — shared by both intake paths
// (Connect Gmail sync and email forwarding), so they behave identically.
// New jobs are inserted (deduped by the user's job key, lib/job-key.ts, kept in
// the linkedin_job_id column); a job
// seen again while still open is resurfaced and tagged "Re-newed"; one a time or
// no-reply rule closed is reopened, since the role is clearly still advertised;
// other discarded/closed leads are left alone.

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobLeads as leadsT, leadAutoActions as autoActionsT } from "@/db/schema";
import { isJobOpen } from "@/lib/types";
import { sourceFromUrl } from "@/lib/lead-source";
import type { LeadDraft } from "@/lib/lead-draft";
import { mergeTags } from "@/lib/lead-tags";
import { leadRoomLeft } from "@/lib/entitlements";
import { notifyLeadLimitReached } from "@/lib/plan-notices";
import { REOPENABLE_RULES, type AutoActionRule } from "@/lib/lead-rules-model";

/** The rule action to reverse if this closed lead shows up in an alert again. */
async function reopenableAction(userId: string, leadId: string, status: string) {
  const actions = await db
    .select({ rule: autoActionsT.rule, from: autoActionsT.fromStatus, to: autoActionsT.toStatus, cleared: autoActionsT.clearedAt, undone: autoActionsT.undoneAt })
    .from(autoActionsT)
    .where(and(eq(autoActionsT.userId, userId), eq(autoActionsT.leadId, leadId)))
    .orderBy(desc(autoActionsT.createdAt));
  // The user undid an earlier reopen: leave it closed.
  if (actions.some((a) => a.rule === "job-came-back" && a.undone)) return null;
  const latest = actions[0];
  return latest &&
    !latest.cleared &&
    !latest.undone &&
    latest.to === status &&
    REOPENABLE_RULES.includes(latest.rule as AutoActionRule)
    ? latest
    : null;
}

export async function ingestAlertDrafts(
  userId: string,
  drafts: LeadDraft[],
  sourceMessageId: string,
): Promise<{ inserted: number; renewed: number; overLimit: number }> {
  let inserted = 0;
  let renewed = 0;
  // New jobs beyond the plan's active-lead limit aren't added (repeats of jobs
  // already on the list still refresh them).
  let room = await leadRoomLeft(userId);
  let overLimit = 0;
  for (const raw of drafts) {
    const d = { ...raw, tags: mergeTags(raw.tags) };
    const [existing] = await db
      .select({ id: leadsT.id, status: leadsT.status, closeOutcome: leadsT.closeOutcome, tags: leadsT.tags })
      .from(leadsT)
      .where(and(eq(leadsT.userId, userId), eq(leadsT.linkedinJobId, d.jobKey)));

    if (!existing) {
      if (room !== null && room <= 0) {
        overLimit++;
        continue;
      }
      const res = await db
        .insert(leadsT)
        .values({
          userId,
          linkedinJobId: d.jobKey,
          title: d.title,
          company: d.company,
          location: d.location,
          remote: d.remote,
          tags: d.tags,
          postedRelative: d.postedRelative,
          canonicalJobUrl: d.canonicalJobUrl,
          sourceMessageId,
          source: sourceFromUrl(d.canonicalJobUrl),
          origin: "system",
        })
        // A concurrent delivery of the same alert may have just inserted it.
        .onConflictDoNothing()
        .returning({ id: leadsT.id });
      if (res.length) {
        inserted++;
        if (room !== null) room--;
      }
    } else if (isJobOpen(existing.status)) {
      const mergedTags = mergeTags(existing.tags, d.tags, ["Re-newed"]);
      await db
        .update(leadsT)
        .set({ capturedAt: new Date(), tags: mergedTags, updatedAt: new Date() })
        .where(eq(leadsT.id, existing.id));
      renewed++;
    } else {
      const action = await reopenableAction(userId, existing.id, existing.status);
      if (!action) continue;
      if (room !== null && room <= 0) {
        overLimit++;
        continue;
      }
      await db.transaction(async (tx) => {
        await tx
          .update(leadsT)
          .set({
            status: action.from,
            closeOutcome: null,
            capturedAt: new Date(),
            tags: mergeTags(existing.tags, d.tags, ["Re-newed"]),
          })
          .where(eq(leadsT.id, existing.id));
        await tx.insert(autoActionsT).values({
          userId,
          leadId: existing.id,
          rule: "job-came-back",
          fromStatus: existing.status,
          fromCloseOutcome: existing.closeOutcome,
          toStatus: action.from,
          reason: "Reopened automatically: this job appeared in a new alert, so the role looks open again.",
        });
      });
      if (room !== null) room--;
      renewed++;
    }
  }
  if (overLimit > 0) await notifyLeadLimitReached(userId, overLimit);
  return { inserted, renewed, overLimit };
}
