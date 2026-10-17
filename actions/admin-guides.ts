"use server";

// Admin How-to guides (Operations). Admin-guarded, Zod-validated (content shape +
// URL rules in lib/guides-schema.ts). Every change revalidates the admin list and
// the user /guides page, so edits are live immediately.

import { asc, eq, max, ne, and } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/current-user";
import { guideTopics } from "@/db/schema";
import { guideTopicSchema } from "@/lib/guides-schema";

type Result = { ok: true } | { ok: false; error: string };

const zId = z.string().uuid();

function revalidate() {
  revalidatePath("/jmp-admin/guides");
  revalidatePath("/guides");
}

function firstIssue(e: z.ZodError): string {
  const i = e.issues[0];
  if (!i) return "Invalid input.";
  // Point at the place in the content ("Section 2, block 3: …").
  const sec = i.path[0] === "sections" && typeof i.path[1] === "number" ? i.path[1] + 1 : null;
  const blk = i.path[2] === "blocks" && typeof i.path[3] === "number" ? i.path[3] + 1 : null;
  const where = sec ? `Section ${sec}${blk ? `, block ${blk}` : ""}: ` : "";
  return where + i.message;
}

async function slugTaken(slug: string, exceptId?: string): Promise<boolean> {
  const [row] = await db
    .select({ id: guideTopics.id })
    .from(guideTopics)
    .where(exceptId ? and(eq(guideTopics.slug, slug), ne(guideTopics.id, exceptId)) : eq(guideTopics.slug, slug));
  return !!row;
}

export async function createGuideAction(input: unknown): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const adminId = await requireAdmin();
  const p = guideTopicSchema.safeParse(input);
  if (!p.success) return { ok: false, error: firstIssue(p.error) };
  const v = p.data;
  if (await slugTaken(v.slug)) return { ok: false, error: "Another guide already uses that URL id." };

  const [{ top }] = await db.select({ top: max(guideTopics.sortOrder) }).from(guideTopics);
  const [row] = await db
    .insert(guideTopics)
    .values({
      slug: v.slug,
      title: v.title,
      summary: v.summary,
      icon: v.icon,
      groupName: v.group,
      status: v.status,
      inProgress: v.inProgress,
      sections: v.sections,
      sortOrder: (top ?? 0) + 10,
      updatedBy: adminId,
    })
    .returning({ id: guideTopics.id });
  revalidate();
  return { ok: true, id: row.id };
}

export async function updateGuideAction(id: unknown, input: unknown): Promise<Result> {
  const adminId = await requireAdmin();
  const gid = zId.safeParse(id);
  if (!gid.success) return { ok: false, error: "Invalid guide." };
  const p = guideTopicSchema.safeParse(input);
  if (!p.success) return { ok: false, error: firstIssue(p.error) };
  const v = p.data;
  if (await slugTaken(v.slug, gid.data)) return { ok: false, error: "Another guide already uses that URL id." };

  const [row] = await db
    .update(guideTopics)
    .set({
      slug: v.slug,
      title: v.title,
      summary: v.summary,
      icon: v.icon,
      groupName: v.group,
      status: v.status,
      inProgress: v.inProgress,
      sections: v.sections,
      updatedBy: adminId,
    })
    .where(eq(guideTopics.id, gid.data))
    .returning({ id: guideTopics.id });
  if (!row) return { ok: false, error: "Guide not found." };
  revalidate();
  return { ok: true };
}

export async function setGuideStatusAction(id: unknown, status: unknown): Promise<Result> {
  const adminId = await requireAdmin();
  const gid = zId.safeParse(id);
  const s = z.enum(["active", "inactive"]).safeParse(status);
  if (!gid.success || !s.success) return { ok: false, error: "Invalid request." };
  const [row] = await db
    .update(guideTopics)
    .set({ status: s.data, updatedBy: adminId })
    .where(eq(guideTopics.id, gid.data))
    .returning({ id: guideTopics.id });
  if (!row) return { ok: false, error: "Guide not found." };
  revalidate();
  return { ok: true };
}

export async function deleteGuideAction(id: unknown): Promise<Result> {
  await requireAdmin();
  const gid = zId.safeParse(id);
  if (!gid.success) return { ok: false, error: "Invalid guide." };
  const [row] = await db.delete(guideTopics).where(eq(guideTopics.id, gid.data)).returning({ id: guideTopics.id });
  if (!row) return { ok: false, error: "Guide not found." };
  revalidate();
  return { ok: true };
}

/**
 * Move a topic one place up/down WITHIN its menu group (the order users see),
 * then renumber everything 10, 20, 30… in that displayed order. Groups keep
 * their place (a group sits where its first topic is).
 */
export async function moveGuideAction(id: unknown, direction: unknown): Promise<Result> {
  await requireAdmin();
  const gid = zId.safeParse(id);
  const dir = z.enum(["up", "down"]).safeParse(direction);
  if (!gid.success || !dir.success) return { ok: false, error: "Invalid request." };

  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: guideTopics.id, group: guideTopics.groupName })
      .from(guideTopics)
      .orderBy(asc(guideTopics.sortOrder), asc(guideTopics.title));
    // Displayed order: grouped by heading, headings in first-appearance order.
    const groups: { label: string; ids: string[] }[] = [];
    for (const r of rows) {
      const g = groups.find((x) => x.label === r.group);
      if (g) g.ids.push(r.id);
      else groups.push({ label: r.group, ids: [r.id] });
    }
    const group = groups.find((g) => g.ids.includes(gid.data));
    if (!group) return;
    const i = group.ids.indexOf(gid.data);
    const j = dir.data === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= group.ids.length) return;
    [group.ids[i], group.ids[j]] = [group.ids[j], group.ids[i]];
    const order = groups.flatMap((g) => g.ids);
    for (let k = 0; k < order.length; k++) {
      await tx.update(guideTopics).set({ sortOrder: (k + 1) * 10 }).where(eq(guideTopics.id, order[k]));
    }
  });
  revalidate();
  return { ok: true };
}
