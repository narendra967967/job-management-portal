import "server-only";

// Reads for How-to guides: every topic for the admin list/editor, active ones
// (in menu order) for users.

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { guideTopics } from "@/db/schema";
import type { GuideTopic } from "@/lib/guides-model";
import { sanitizeGuideHtml } from "@/lib/guide-html";

type Row = typeof guideTopics.$inferSelect;

function toTopic(r: Row): GuideTopic {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    icon: r.icon,
    sortOrder: r.sortOrder,
    status: r.status,
    inProgress: r.inProgress,
    // Sanitized again on the way out, so even a row edited directly in the DB
    // can't inject script.
    contentHtml: sanitizeGuideHtml(r.contentHtml),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** All topics (admin), in menu order. */
export async function loadAllGuides(): Promise<GuideTopic[]> {
  const rows = await db.select().from(guideTopics).orderBy(asc(guideTopics.sortOrder), asc(guideTopics.title));
  return rows.map(toTopic);
}

/** Active topics only (user /guides), in menu order. */
export async function loadActiveGuides(): Promise<GuideTopic[]> {
  const rows = await db
    .select()
    .from(guideTopics)
    .where(eq(guideTopics.status, "active"))
    .orderBy(asc(guideTopics.sortOrder), asc(guideTopics.title));
  return rows.map(toTopic);
}

/** One topic by id (admin editor), or null. */
export async function loadGuide(id: string): Promise<GuideTopic | null> {
  const [row] = await db.select().from(guideTopics).where(eq(guideTopics.id, id));
  return row ? toTopic(row) : null;
}
