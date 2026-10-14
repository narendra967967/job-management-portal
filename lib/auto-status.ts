import "server-only";

// Automatic, forward-only status changes driven by what the user does on a
// lead (#14). Rules:
//  - only moves FORWARD along new → shortlisted → applied → interview → offer;
//  - never touches discarded / closed leads;
//  - respects the user's "Update status automatically" setting (default on);
//  - leaves a lead alone while it's pinned (the user manually moved it
//    backwards — see setLeadStatusAction).
// Callers pass their transaction (or db) and report the change back to the
// client, which shows a toast with Undo.

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  jobLeads as leadsT,
  userSettings as settingsT,
} from "@/db/schema";
import { OPEN_LEAD_STATUSES, type LeadStatus } from "@/lib/types";

type Exec = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface AutoStatusChange {
  leadId: string;
  from: LeadStatus;
  to: LeadStatus;
}

/** Position in the open pipeline; -1 for terminal statuses. */
export function pipelineRank(status: LeadStatus): number {
  return OPEN_LEAD_STATUSES.indexOf(status);
}

/**
 * Move `leadId` forward to `target` if the rules allow it. Returns the change
 * (for the Undo toast), or null when nothing moved.
 */
export async function advanceLeadStatus(
  exec: Exec,
  userId: string,
  leadId: string,
  target: LeadStatus,
): Promise<AutoStatusChange | null> {
  const [settings] = await exec
    .select({ autoStatus: settingsT.autoStatus })
    .from(settingsT)
    .where(eq(settingsT.userId, userId));
  if (settings && !settings.autoStatus) return null;

  const [lead] = await exec
    .select({ status: leadsT.status, pinned: leadsT.statusPinned })
    .from(leadsT)
    .where(and(eq(leadsT.id, leadId), eq(leadsT.userId, userId)));
  if (!lead || lead.pinned) return null;

  const from = lead.status;
  const fromRank = pipelineRank(from);
  if (fromRank < 0) return null; // discarded / closed — never touched
  if (pipelineRank(target) <= fromRank) return null; // forward only

  // Guard on the status we read, so a concurrent manual change wins.
  const [row] = await exec
    .update(leadsT)
    .set({ status: target })
    .where(
      and(
        eq(leadsT.id, leadId),
        eq(leadsT.userId, userId),
        eq(leadsT.status, from),
      ),
    )
    .returning({ id: leadsT.id });
  return row ? { leadId, from, to: target } : null;
}
