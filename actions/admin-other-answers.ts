"use server";

// Admin → Customers → Other answers: what users typed after picking "Other"
// in a dropdown, grouped by value (case and spacing ignored) with how often
// and by how many users, plus the status an admin gave each value. The answers
// live on their own records, so a deleted account's answers are gone too.

import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { otherAnswerReviews } from "@/db/schema";
import { requireAdmin } from "@/lib/current-user";
import { OTHER_FIELD_KEYS, OTHER_MAX, otherKey, type OtherField, type OtherStatus } from "@/lib/other-answers-model";

/**
 * Where each field's answers live: one row per answer, with the typed text,
 * who gave it and when. Add a line here when another dropdown gets "Other".
 */
const SOURCES: Record<OtherField, ReturnType<typeof sql>> = {
  interview_industry: sql`select industry_other as value, user_id, created_at from ai_interviews where industry = 'Other' and industry_other is not null`,
};

export interface OtherAnswerRow {
  field: OtherField;
  /** Grouping key (lower-case); with field, identifies the row. */
  key: string;
  /** The spelling most people used. */
  value: string;
  answers: number;
  users: number;
  firstAt: string;
  lastAt: string;
  status: OtherStatus;
  reviewedAt: string | null;
}

export async function listOtherAnswersAction(): Promise<OtherAnswerRow[]> {
  await requireAdmin();
  const rows: OtherAnswerRow[] = [];
  for (const field of OTHER_FIELD_KEYS) {
    const res = await db.execute<{ key: string; value: string; answers: number; users: number; first_at: Date | string; last_at: Date | string }>(sql`
      with a as (${SOURCES[field]}),
      k as (select lower(regexp_replace(btrim(value), '\\s+', ' ', 'g')) as key, btrim(value) as value, user_id, created_at from a)
      select key,
             mode() within group (order by value) as value,
             count(*)::int as answers,
             count(distinct user_id)::int as users,
             min(created_at) as first_at,
             max(created_at) as last_at
      from k where key <> '' group by key`);
    const reviews = await db.select().from(otherAnswerReviews).where(eq(otherAnswerReviews.field, field));
    const byKey = new Map(reviews.map((r) => [r.valueKey, r]));
    const keys = new Set<string>();
    for (const r of res.rows) {
      keys.add(r.key);
      const review = byKey.get(r.key);
      rows.push({
        field,
        key: r.key,
        value: r.value,
        answers: r.answers,
        users: r.users,
        firstAt: new Date(r.first_at).toISOString(),
        lastAt: new Date(r.last_at).toISOString(),
        status: (review?.status as OtherStatus | undefined) ?? "new",
        reviewedAt: review ? review.updatedAt.toISOString() : null,
      });
    }
    // A mark whose answers are all gone (deleted accounts) holds typed text
    // nobody has any more: remove it.
    const orphans = reviews.filter((r) => !keys.has(r.valueKey)).map((r) => r.valueKey);
    if (orphans.length) await db.delete(otherAnswerReviews).where(and(eq(otherAnswerReviews.field, field), inArray(otherAnswerReviews.valueKey, orphans)));
  }
  return rows.sort((a, b) => b.answers - a.answers || b.lastAt.localeCompare(a.lastAt));
}

const markSchema = z.object({
  items: z
    .array(z.object({ field: z.enum(OTHER_FIELD_KEYS as [OtherField, ...OtherField[]]), key: z.string().min(1).max(OTHER_MAX * 2) }))
    .min(1, "Pick at least one answer.")
    .max(500, "Mark up to 500 at a time."),
  status: z.enum(["new", "added", "not_adding"]),
});

/** Set the status of one or more grouped answers. "New" clears the mark. */
export async function markOtherAnswersAction(input: unknown): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const adminId = await requireAdmin();
  const p = markSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the selection and try again." };
  const { items, status } = p.data;
  // Only keys as the list makes them, so a mark always matches its answers.
  const clean = items.filter((i) => otherKey(i.key) === i.key);
  if (!clean.length) return { ok: false, error: "Those answers weren't found. Reload the page." };
  await db.transaction(async (tx) => {
    for (const { field, key } of clean) {
      if (status === "new") {
        await tx.delete(otherAnswerReviews).where(and(eq(otherAnswerReviews.field, field), eq(otherAnswerReviews.valueKey, key)));
      } else {
        await tx
          .insert(otherAnswerReviews)
          .values({ field, valueKey: key, status, updatedBy: adminId })
          .onConflictDoUpdate({ target: [otherAnswerReviews.field, otherAnswerReviews.valueKey], set: { status, updatedBy: adminId, updatedAt: new Date() } });
      }
    }
  });
  return { ok: true, count: clean.length };
}
