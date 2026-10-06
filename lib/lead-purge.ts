import "server-only";

// Automatic stale-lead cleanup (admin Settings → Cron → Lead retention). When
// enabled, deletes leads in the configured statuses that have had no activity for
// N+ days, PER USER. Deletion is irreversible, so every run is recorded in
// lead_purge_log (per user, per-status counts) and the affected user is emailed
// with the counts + the policy. Runs only via the cron route when purge is on.

import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { cronConfig, jobLeads as leadsT, leadPurgeLog, user as userT } from "@/db/schema";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/types";
import { sendAppEmail, SMTP_NOT_CONFIGURED } from "@/lib/email";
import { createNotification } from "@/lib/notifications";

export interface PurgeUserResult {
  userId: string;
  totalDeleted: number;
  counts: Record<string, number>;
  notified: boolean;
}

export interface PurgeRunResult {
  ran: boolean;
  reason?: string;
  policyDays?: number;
  statuses?: string[];
  users?: PurgeUserResult[];
  totalDeleted?: number;
}

const ALL_STATUSES = new Set<string>(Object.keys(LEAD_STATUS_LABELS));

function labelFor(status: string): string {
  return LEAD_STATUS_LABELS[status as LeadStatus] ?? status;
}

async function emailUser(
  userId: string,
  counts: Record<string, number>,
  total: number,
  days: number,
  statuses: string[],
): Promise<boolean> {
  const [u] = await db.select({ email: userT.email, name: userT.name }).from(userT).where(eq(userT.id, userId));
  if (!u?.email) return false;

  const rows = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(
      ([s, n]) =>
        `<tr><td style="padding:4px 12px 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#374151;">${labelFor(s)}</td><td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;font-weight:bold;">${n}</td></tr>`,
    )
    .join("");
  const policyStatuses = statuses.map(labelFor).join(", ");
  const bodyHtml = `
    <p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#374151;">As part of routine database cleanup, <strong>${total}</strong> old lead${total === 1 ? "" : "s"} w${total === 1 ? "as" : "ere"} removed from your account.</p>
    <table cellpadding="0" cellspacing="0" style="margin:0 0 14px;">${rows}</table>
    <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#6b7280;">Policy: leads marked <strong>${policyStatuses}</strong> with no activity for <strong>${days}+ days</strong> are removed automatically.</p>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#6b7280;">This is a preset system policy that keeps the workspace tidy — no action is needed on your part.</p>
  `;

  try {
    await sendAppEmail({
      to: u.email,
      subject: "Old leads cleared from your account",
      heading: "Automatic cleanup of old leads",
      bodyHtml,
      text: `${total} old leads were removed from your account as part of routine cleanup. Policy: leads marked ${policyStatuses} with no activity for ${days}+ days are removed automatically. This is a preset system policy — no action needed.`,
    });
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg !== SMTP_NOT_CONFIGURED) {
      console.error(`[lead-purge] email failed for ${userId}:`, msg);
    }
    return false;
  }
}

/** Run the purge for all users per the current policy. Safe no-op when disabled. */
export async function runLeadPurge(): Promise<PurgeRunResult> {
  const [cfg] = await db.select().from(cronConfig).limit(1);
  if (!cfg?.purgeEnabled) return { ran: false, reason: "disabled" };

  // Validate statuses against the known enum values (defensive).
  const statuses = (cfg.purgeStatuses ?? []).filter((s) => ALL_STATUSES.has(s)) as LeadStatus[];
  if (statuses.length === 0) return { ran: false, reason: "no statuses selected" };

  const days = cfg.purgeDays ?? 90;
  const cutoff = new Date(Date.now() - days * 86_400_000);

  // Users who currently have purgeable leads.
  const users = await db
    .selectDistinct({ userId: leadsT.userId })
    .from(leadsT)
    .where(and(inArray(leadsT.status, statuses), lt(leadsT.updatedAt, cutoff)));

  const results: PurgeUserResult[] = [];
  let grandTotal = 0;

  for (const { userId } of users) {
    // Delete scoped to this user; return the statuses so we can count per status.
    const deleted = await db
      .delete(leadsT)
      .where(and(eq(leadsT.userId, userId), inArray(leadsT.status, statuses), lt(leadsT.updatedAt, cutoff)))
      .returning({ status: leadsT.status });

    if (deleted.length === 0) continue;

    const counts: Record<string, number> = {};
    for (const r of deleted) counts[r.status] = (counts[r.status] ?? 0) + 1;
    const total = deleted.length;
    grandTotal += total;

    // Record the audit log first (deletion already happened — keep it accountable
    // even if the notification email fails).
    const [log] = await db
      .insert(leadPurgeLog)
      .values({ userId, policyDays: days, statuses, counts, totalDeleted: total, notified: false })
      .returning({ id: leadPurgeLog.id });

    // Persistent in-app notification (same message as the email).
    const breakdown = Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(([s, n]) => `${n} ${labelFor(s)}`)
      .join(", ");
    const policyStatuses = statuses.map(labelFor).join(", ");
    await createNotification(userId, {
      type: "lead-purge",
      title: "Old leads cleared",
      body: `${total} old lead${total === 1 ? "" : "s"} removed (${breakdown}) as part of routine database cleanup. Preset policy: leads marked ${policyStatuses} with no activity for ${days}+ days are removed automatically — no action needed.`,
    });

    const notified = await emailUser(userId, counts, total, days, statuses);
    if (notified && log) {
      await db.update(leadPurgeLog).set({ notified: true }).where(eq(leadPurgeLog.id, log.id));
    }

    results.push({ userId, totalDeleted: total, counts, notified });
  }

  return { ran: true, policyDays: days, statuses, users: results, totalDeleted: grandTotal };
}
