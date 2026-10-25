import "server-only";

// Turn parsed job-alert drafts into leads — shared by both intake paths
// (Connect Gmail sync and email forwarding), so they behave identically.
// New jobs are inserted (deduped by the user's job key, lib/job-key.ts, kept in
// the linkedin_job_id column); a job
// seen again while still open is resurfaced and tagged "Re-newed";
// discarded/closed leads are left alone.

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobLeads as leadsT } from "@/db/schema";
import { isJobOpen } from "@/lib/types";
import { sourceFromUrl } from "@/lib/lead-source";
import type { LeadDraft } from "@/lib/lead-draft";
import { mergeTags } from "@/lib/lead-tags";
import { leadRoomLeft } from "@/lib/entitlements";
import { notifyLeadLimitReached } from "@/lib/plan-notices";

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
      .select({ id: leadsT.id, status: leadsT.status, tags: leadsT.tags })
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
    }
  }
  if (overLimit > 0) await notifyLeadLimitReached(userId, overLimit);
  return { inserted, renewed, overLimit };
}
