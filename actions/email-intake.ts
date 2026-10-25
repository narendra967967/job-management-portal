"use server";

// Email forwarding — user actions (Settings → Email forwarding). Always scoped
// to the signed-in user; the address is created on first use.

import { z } from "zod";
import { getCurrentUserId } from "@/lib/current-user";
import {
  getIntakeConfig,
  getOrCreateForwarding,
  listInboundLog,
  markForwardingConfirmed,
  resetForwarding,
} from "@/lib/email-intake-data";
import { getRetentionConfig } from "@/lib/retention";
import {
  INBOUND_LOG_PAGE_SIZES,
  INBOUND_STATUS_LABELS,
  siteLabel,
  userReason,
  type InboundStatus,
  type MyEmailLogRow,
  type MyForwarding,
} from "@/lib/email-intake-model";

export interface MyForwardingState {
  forwardingEnabled: boolean;
  forwarding: MyForwarding;
}

/** Current address + progress (polled while waiting for Gmail's code). */
export async function getMyForwardingAction(): Promise<MyForwardingState> {
  const userId = await getCurrentUserId();
  const [config, forwarding] = await Promise.all([getIntakeConfig(), getOrCreateForwarding(userId)]);
  return { forwardingEnabled: config.forwardingEnabled, forwarding };
}

/** Replace the address; the old one stops working immediately. */
export async function resetMyForwardingAction(): Promise<MyForwardingState> {
  const userId = await getCurrentUserId();
  const [config, forwarding] = await Promise.all([getIntakeConfig(), resetForwarding(userId)]);
  return { forwardingEnabled: config.forwardingEnabled, forwarding };
}

/** "I've verified it in Gmail" — Gmail never tells us, so the user does. */
export async function confirmMyForwardingAction(): Promise<MyForwardingState> {
  const userId = await getCurrentUserId();
  await markForwardingConfirmed(userId);
  return getMyForwardingAction();
}

/* ---------------- Email log (Settings → Email log) ---------------- */

const DAY_MS = 24 * 60 * 60_000;
const MAX_RANGE_DAYS = 366;
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");
const emailLogQuery = z.object({
  from: ymd,
  to: ymd,
  /** Browser getTimezoneOffset() (minutes, UTC − local). */
  tzo: z.number().int().min(-840).max(840),
  status: z.union([z.literal("all"), z.enum(Object.keys(INBOUND_STATUS_LABELS) as [InboundStatus, ...InboundStatus[]])]),
  page: z.number().int().min(1).max(10_000),
  size: z.number().refine((n) => (INBOUND_LOG_PAGE_SIZES as readonly number[]).includes(n)),
});

/** "YYYY-MM-DD" → that date's midnight in the viewer's timezone, as an instant. */
function localMidnight(date: string, tzo: number): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) + tzo * 60_000;
}

/** The signed-in user's inbound emails (to their own forwarding address only),
 *  newest first. Metadata only — the log never stores email content. */
export async function listMyEmailLogAction(
  input: unknown,
): Promise<{ ok: true; rows: MyEmailLogRow[]; total: number; retentionDays: number } | { ok: false; error: string }> {
  const userId = await getCurrentUserId();
  const p = emailLogQuery.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Invalid filters." };
  const q = p.data;

  let since = localMidnight(q.from, q.tzo);
  let until = localMidnight(q.to, q.tzo);
  if (since > until) [since, until] = [until, since];
  until += DAY_MS; // "to" is inclusive
  since = Math.max(since, until - MAX_RANGE_DAYS * DAY_MS);

  const [{ rows, total }, retention] = await Promise.all([
    listInboundLog({
      since: new Date(since),
      until: new Date(until),
      status: q.status === "all" ? undefined : q.status,
      userId,
      page: q.page,
      size: q.size,
    }),
    getRetentionConfig(),
  ]);
  return {
    ok: true,
    total,
    retentionDays: retention.inboundLogDays,
    rows: rows.map((r) => ({
      id: r.id,
      receivedAt: r.receivedAt,
      site: siteLabel(r.site),
      sender: r.fromAddress ?? r.fromDomain,
      status: r.status,
      reason: userReason(r.status, r.reason),
      leadsCreated: r.leadsCreated,
    })),
  };
}
