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

export async function ingestAlertDrafts(
  userId: string,
  drafts: LeadDraft[],
  sourceMessageId: string,
): Promise<{ inserted: number; renewed: number }> {
  let inserted = 0;
  let renewed = 0;
  for (const d of drafts) {
    const [existing] = await db
      .select({ id: leadsT.id, status: leadsT.status, tags: leadsT.tags })
      .from(leadsT)
      .where(and(eq(leadsT.userId, userId), eq(leadsT.linkedinJobId, d.jobKey)));

    if (!existing) {
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
      if (res.length) inserted++;
    } else if (isJobOpen(existing.status)) {
      const mergedTags = [...new Set([...existing.tags, ...d.tags, "Re-newed"])];
      await db
        .update(leadsT)
        .set({ capturedAt: new Date(), tags: mergedTags, updatedAt: new Date() })
        .where(eq(leadsT.id, existing.id));
      renewed++;
    }
  }
  return { inserted, renewed };
}
