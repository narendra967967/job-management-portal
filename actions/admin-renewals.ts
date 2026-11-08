"use server";

// Admin → Renewals: plans ending soon (and recently ended, i.e. users in
// limited mode) with how many reminder emails each has had, plus the log of
// reminder emails. Admin-guarded, read only.

import { and, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { planRemindersSent, plans, user } from "@/db/schema";
import { requireAdmin } from "@/lib/current-user";

const DAY_MS = 86_400_000;
/** How far ahead and back the Upcoming list looks (a "use server" file may
 *  only export async functions, so the screen repeats this number). */
const RENEWAL_WINDOW_DAYS = 90;
const MAX_ROWS = 5000;

export interface RenewalRow {
  userId: string;
  name: string;
  email: string;
  planName: string;
  /** On the free trial (the default free plan). */
  trial: boolean;
  status: string;
  expiresAt: string;
  /** Reminder emails sent for THIS expiry (0–7), and the latest one. */
  remindersSent: number;
  remindersFailed: number;
  lastReminderAt: string | null;
}

/** Users whose plan ends within the next 90 days or ended in the last 90. */
export async function listRenewalsAction(): Promise<{ rows: RenewalRow[]; capped: boolean }> {
  await requireAdmin();
  const now = Date.now();
  const list = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      expiresAt: user.planExpiresAt,
      planName: plans.name,
      isFree: plans.isFree,
    })
    .from(user)
    .leftJoin(plans, sql`${plans.id}::text = ${user.planId}`)
    .where(
      and(
        ne(user.role, "admin"),
        gte(user.planExpiresAt, new Date(now - RENEWAL_WINDOW_DAYS * DAY_MS)),
        lte(user.planExpiresAt, new Date(now + RENEWAL_WINDOW_DAYS * DAY_MS)),
      ),
    )
    .orderBy(user.planExpiresAt)
    .limit(MAX_ROWS + 1);
  const rows = list.slice(0, MAX_ROWS);

  // Reminders per (user, expiry): only those about the CURRENT expiry count.
  const counts = rows.length
    ? await db
        .select({
          userId: planRemindersSent.userId,
          expiresAt: planRemindersSent.expiresAt,
          sent: sql<number>`count(*) filter (where ${planRemindersSent.status} = 'sent')::int`,
          failed: sql<number>`count(*) filter (where ${planRemindersSent.status} = 'failed')::int`,
          last: sql<Date | null>`max(${planRemindersSent.sentAt})`,
        })
        .from(planRemindersSent)
        .where(inArray(planRemindersSent.userId, rows.map((r) => r.userId)))
        .groupBy(planRemindersSent.userId, planRemindersSent.expiresAt)
    : [];
  const key = (id: string, d: Date) => `${id}|${d.getTime()}`;
  const byKey = new Map(counts.map((c) => [key(c.userId, new Date(c.expiresAt)), c]));

  return {
    capped: list.length > MAX_ROWS,
    rows: rows.map((r) => {
      const c = r.expiresAt ? byKey.get(key(r.userId, r.expiresAt)) : undefined;
      return {
        userId: r.userId,
        name: r.name,
        email: r.email,
        planName: r.planName ?? "No plan",
        trial: r.isFree ?? false,
        status: r.status ?? "active",
        expiresAt: r.expiresAt!.toISOString(),
        remindersSent: c?.sent ?? 0,
        remindersFailed: c?.failed ?? 0,
        lastReminderAt: c?.last ? new Date(c.last).toISOString() : null,
      };
    }),
  };
}

export interface ReminderLogRow {
  id: string;
  sentAt: string;
  userId: string;
  name: string;
  email: string;
  planName: string;
  upsellName: string | null;
  /** 7 … 1 days before the plan ended. */
  daysBefore: number;
  expiresAt: string;
  status: "sent" | "failed";
  error: string | null;
}

const rangeSchema = z.object({ from: z.string().datetime(), to: z.string().datetime() });

/** Reminder emails sent in [from, to] (ISO instants), newest first. */
export async function listReminderLogAction(raw: unknown): Promise<{ rows: ReminderLogRow[]; capped: boolean }> {
  await requireAdmin();
  const parsed = rangeSchema.safeParse(raw);
  if (!parsed.success) return { rows: [], capped: false };
  const list = await db
    .select({
      userId: planRemindersSent.userId,
      expiresAt: planRemindersSent.expiresAt,
      daysBefore: planRemindersSent.daysBefore,
      sentAt: planRemindersSent.sentAt,
      status: planRemindersSent.status,
      error: planRemindersSent.error,
      upsellPlanId: planRemindersSent.upsellPlanId,
      name: user.name,
      email: user.email,
      planName: plans.name,
    })
    .from(planRemindersSent)
    .innerJoin(user, eq(user.id, planRemindersSent.userId))
    .leftJoin(plans, eq(plans.id, planRemindersSent.planId))
    .where(
      and(gte(planRemindersSent.sentAt, new Date(parsed.data.from)), lte(planRemindersSent.sentAt, new Date(parsed.data.to))),
    )
    .orderBy(desc(planRemindersSent.sentAt))
    .limit(MAX_ROWS + 1);

  const upsellIds = [...new Set(list.map((r) => r.upsellPlanId).filter((x): x is string => !!x))];
  const names = upsellIds.length
    ? new Map((await db.select({ id: plans.id, name: plans.name }).from(plans).where(inArray(plans.id, upsellIds))).map((p) => [p.id, p.name]))
    : new Map<string, string>();

  return {
    capped: list.length > MAX_ROWS,
    rows: list.slice(0, MAX_ROWS).map((r) => ({
      id: `${r.userId}|${r.expiresAt.getTime()}|${r.daysBefore}`,
      sentAt: r.sentAt.toISOString(),
      userId: r.userId,
      name: r.name,
      email: r.email,
      planName: r.planName ?? "Deleted plan",
      upsellName: r.upsellPlanId ? (names.get(r.upsellPlanId) ?? null) : null,
      daysBefore: r.daysBefore,
      expiresAt: r.expiresAt.toISOString(),
      status: r.status === "failed" ? "failed" : "sent",
      error: r.error,
    })),
  };
}
