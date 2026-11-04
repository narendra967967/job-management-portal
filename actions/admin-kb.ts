"use server";

// Admin knowledge base. Every action checks for an admin session and validates
// its input. Repo articles (docs/knowledge-base) are read-only here: they change
// in the repo and arrive through the sync.

import { randomBytes } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/current-user";
import {
  kbArticles,
  kbArticleVersions,
  kbConversations,
  kbMessages,
  kbQuestions,
} from "@/db/schema";
import { sanitizeGuideHtml } from "@/lib/guide-html";
import { slugify } from "@/lib/guides-model";
import {
  KB_QUESTION_MAX,
  kbArticleInputSchema,
  kbHtmlToText,
  normalizeQuestion,
  type KbArticleInput,
} from "@/lib/kb-model";
import { answerKbQuestion, type KbTurn } from "@/lib/kb-agent";
import { syncKbFromRepo, type KbSyncResult } from "@/lib/kb-files";

type Result = { ok: true } | { ok: false; error: string };

const zId = z.string().uuid();
const NOT_EDITABLE = "Repository articles are changed in the repo, not here.";

const revalidate = () => revalidatePath("/jmp-admin/knowledge-base", "layout");
const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid input.";

/** A published article titled like an open question covers it. */
async function coverQuestions(title: string) {
  await db
    .update(kbQuestions)
    .set({ status: "covered" })
    .where(and(eq(kbQuestions.normalized, normalizeQuestion(title)), eq(kbQuestions.status, "open")));
}

async function adminArticle(id: string) {
  const [a] = await db.select().from(kbArticles).where(eq(kbArticles.id, id));
  return a ?? null;
}

/* ---------------- articles ---------------- */

export async function saveKbArticleAction(
  id: string | null,
  input: KbArticleInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const adminId = await requireAdmin();
  const p = kbArticleInputSchema.safeParse(input);
  if (!p.success) return { ok: false, error: firstIssue(p.error) };
  const contentHtml = sanitizeGuideHtml(p.data.contentHtml);
  const contentText = kbHtmlToText(contentHtml);
  if (p.data.status === "published" && !contentText) {
    return { ok: false, error: "A published article needs some text." };
  }
  const values = { ...p.data, contentHtml, contentText, updatedBy: adminId };

  let articleId: string;
  if (id === null) {
    const slug = `admin/${slugify(p.data.title) || "article"}-${randomBytes(3).toString("hex")}`;
    const [row] = await db.insert(kbArticles).values({ ...values, slug, source: "admin" }).returning({ id: kbArticles.id });
    articleId = row.id;
  } else {
    if (!zId.safeParse(id).success) return { ok: false, error: "Article not found." };
    const current = await adminArticle(id);
    if (!current) return { ok: false, error: "Article not found." };
    if (current.source !== "admin") return { ok: false, error: NOT_EDITABLE };
    await db.transaction(async (tx) => {
      // The version being replaced goes into history.
      await tx.insert(kbArticleVersions).values({
        articleId: id,
        title: current.title,
        contentHtml: current.contentHtml,
        savedBy: current.updatedBy,
        savedAt: current.updatedAt,
      });
      await tx.update(kbArticles).set(values).where(eq(kbArticles.id, id));
    });
    articleId = id;
  }
  if (p.data.status === "published") await coverQuestions(p.data.title);
  revalidate();
  return { ok: true, id: articleId };
}

export async function setKbArticleStatusAction(id: string, status: "draft" | "published"): Promise<Result> {
  await requireAdmin();
  if (!zId.safeParse(id).success || !["draft", "published"].includes(status)) return { ok: false, error: "Invalid input." };
  const current = await adminArticle(id);
  if (!current) return { ok: false, error: "Article not found." };
  if (current.source !== "admin") return { ok: false, error: NOT_EDITABLE };
  if (status === "published" && !current.contentText) return { ok: false, error: "Add some text before publishing." };
  await db.update(kbArticles).set({ status }).where(eq(kbArticles.id, id));
  if (status === "published") await coverQuestions(current.title);
  revalidate();
  return { ok: true };
}

export async function deleteKbArticleAction(id: string): Promise<Result> {
  await requireAdmin();
  if (!zId.safeParse(id).success) return { ok: false, error: "Article not found." };
  const current = await adminArticle(id);
  if (!current) return { ok: false, error: "Article not found." };
  if (current.source !== "admin") return { ok: false, error: NOT_EDITABLE };
  await db.delete(kbArticles).where(eq(kbArticles.id, id));
  revalidate();
  return { ok: true };
}

export async function syncKbAction(): Promise<{ ok: true; result: KbSyncResult } | { ok: false; error: string }> {
  await requireAdmin();
  try {
    const result = await syncKbFromRepo();
    revalidate();
    return { ok: true, result };
  } catch (e) {
    console.error("knowledge base sync failed", e);
    return { ok: false, error: "The sync didn't finish. Check the server log." };
  }
}

/* ---------------- asking ---------------- */

const askSchema = z.object({
  conversationId: zId.nullable(),
  question: z.string().trim().min(1, "Type a question.").max(KB_QUESTION_MAX, `Keep it under ${KB_QUESTION_MAX} characters.`),
});

/** How many earlier messages the agent sees, for follow-up questions. */
const HISTORY_TURNS = 4;

/**
 * Questions per admin, so a stuck tab or a stolen session can't run up the
 * AI bill. Counted from stored messages, which survive a restart, and from a
 * tally in memory, which survives deleting conversations; the higher counts.
 */
const ASK_LIMITS = [
  { max: 30, ms: 60 * 60_000, label: "hour" },
  { max: 150, ms: 24 * 60 * 60_000, label: "day" },
] as const;

const g = globalThis as unknown as { __kbAsks?: Map<string, number[]> };
const recentAsks = (g.__kbAsks ??= new Map<string, number[]>());

/** Why this admin can't ask right now, or null when they can. */
async function askLimitReached(adminId: string): Promise<string | null> {
  const now = Date.now();
  const tally = (recentAsks.get(adminId) ?? []).filter((t) => now - t < ASK_LIMITS[1].ms);
  recentAsks.set(adminId, tally);
  const since = new Date(Date.now() - ASK_LIMITS[1].ms);
  const rows = await db
    .select({ at: kbMessages.createdAt })
    .from(kbMessages)
    .innerJoin(kbConversations, eq(kbConversations.id, kbMessages.conversationId))
    .where(and(eq(kbConversations.userId, adminId), eq(kbMessages.role, "user"), sql`${kbMessages.createdAt} > ${since}`))
    .orderBy(desc(kbMessages.createdAt));
  const stored = rows.map((r) => r.at.getTime());
  for (const limit of ASK_LIMITS) {
    const inWindow = [stored, [...tally].reverse()]
      .map((times) => times.filter((t) => now - t < limit.ms))
      .sort((a, b) => b.length - a.length)[0];
    if (inWindow.length < limit.max) continue;
    // Newest first, so this is the question whose ageing out frees a slot.
    const oldest = inWindow[limit.max - 1];
    const wait = Math.max(1, Math.ceil((oldest + limit.ms - now) / 60_000));
    const when = wait < 120 ? `${wait} minute${wait === 1 ? "" : "s"}` : `${Math.ceil(wait / 60)} hours`;
    return `That's ${limit.max} questions in the last ${limit.label}, the most allowed. You can ask again in ${when}.`;
  }
  return null;
}

export async function askKbAction(
  conversationId: string | null,
  question: string,
): Promise<{ ok: true; conversationId: string } | { ok: false; error: string }> {
  const adminId = await requireAdmin();
  const p = askSchema.safeParse({ conversationId, question });
  if (!p.success) return { ok: false, error: firstIssue(p.error) };
  const q = p.data.question;
  const limited = await askLimitReached(adminId);
  if (limited) return { ok: false, error: limited };
  recentAsks.get(adminId)?.push(Date.now());

  let convoId = p.data.conversationId;
  if (convoId) {
    const [own] = await db
      .select({ id: kbConversations.id })
      .from(kbConversations)
      .where(and(eq(kbConversations.id, convoId), eq(kbConversations.userId, adminId)));
    if (!own) convoId = null;
  }
  let history: KbTurn[] = [];
  if (convoId) {
    const rows = await db
      .select({ role: kbMessages.role, text: kbMessages.text })
      .from(kbMessages)
      .where(eq(kbMessages.conversationId, convoId))
      .orderBy(desc(kbMessages.createdAt))
      .limit(HISTORY_TURNS);
    history = rows.reverse().map((m) => ({ role: m.role === "user" ? "user" : "assistant", text: m.text }));
  }
  if (!convoId) {
    const title = q.length > 70 ? `${q.slice(0, 67)}…` : q;
    const [c] = await db.insert(kbConversations).values({ userId: adminId, title }).returning({ id: kbConversations.id });
    convoId = c.id;
  }
  await db.insert(kbMessages).values({ conversationId: convoId, role: "user", text: q });

  const a = await answerKbQuestion(q, history);
  await db.insert(kbMessages).values({
    conversationId: convoId,
    role: "assistant",
    text: a.text,
    sources: a.sources ?? null,
    unanswered: a.outcome === "unanswered",
    outcome: a.outcome,
  });
  await db.update(kbConversations).set({ updatedAt: new Date() }).where(eq(kbConversations.id, convoId));

  if (a.outcome === "unanswered" || a.outcome === "partial") {
    // The same question again counts up and reopens, instead of a new row.
    const partial = a.outcome === "partial";
    await db
      .insert(kbQuestions)
      .values({ question: q, normalized: normalizeQuestion(q), partial })
      .onConflictDoUpdate({
        target: kbQuestions.normalized,
        set: { timesAsked: sql`${kbQuestions.timesAsked} + 1`, lastAskedAt: new Date(), status: "open", partial },
      });
  }
  revalidate();
  return { ok: true, conversationId: convoId };
}

export async function deleteKbConversationAction(id: string): Promise<Result> {
  const adminId = await requireAdmin();
  if (!zId.safeParse(id).success) return { ok: false, error: "Conversation not found." };
  await db.delete(kbConversations).where(and(eq(kbConversations.id, id), eq(kbConversations.userId, adminId)));
  revalidate();
  return { ok: true };
}

/* ---------------- unanswered questions ---------------- */

export async function setKbQuestionStatusAction(id: string, status: "open" | "covered" | "dismissed"): Promise<Result> {
  await requireAdmin();
  if (!zId.safeParse(id).success || !["open", "covered", "dismissed"].includes(status)) {
    return { ok: false, error: "Invalid input." };
  }
  await db.update(kbQuestions).set({ status }).where(eq(kbQuestions.id, id));
  revalidate();
  return { ok: true };
}
