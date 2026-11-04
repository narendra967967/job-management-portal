import "server-only";

// Admin knowledge base reads. Conversations belong to the admin who had them;
// articles and unanswered questions are shared by all admins.

import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  kbArticles,
  kbArticleVersions,
  kbConversations,
  kbMessages,
  kbQuestions,
  user,
} from "@/db/schema";
import type {
  KbArticle,
  KbArticleVersion,
  KbConversation,
  KbConversationSummary,
  KbQuestion,
  KbUsage,
} from "@/lib/kb-model";

const iso = (d: Date) => d.toISOString();

export async function loadKbArticles(): Promise<KbArticle[]> {
  const rows = await db
    .select({ a: kbArticles, by: user.name })
    .from(kbArticles)
    .leftJoin(user, eq(user.id, kbArticles.updatedBy))
    .orderBy(desc(kbArticles.updatedAt));
  return rows.map(({ a, by }) => ({
    id: a.id,
    slug: a.slug,
    source: a.source,
    title: a.title,
    category: a.category,
    summary: a.summary,
    keywords: a.keywords,
    status: a.status,
    contentHtml: a.contentHtml,
    updatedAt: iso(a.updatedAt),
    updatedBy: a.source === "repo" ? null : (by ?? null),
  }));
}

export async function loadKbArticle(
  id: string,
): Promise<{ article: KbArticle; versions: KbArticleVersion[] } | null> {
  const article = (await loadKbArticles()).find((a) => a.id === id);
  if (!article) return null;
  const rows = await db
    .select({ v: kbArticleVersions, by: user.name })
    .from(kbArticleVersions)
    .leftJoin(user, eq(user.id, kbArticleVersions.savedBy))
    .where(eq(kbArticleVersions.articleId, id))
    .orderBy(desc(kbArticleVersions.savedAt))
    .limit(20);
  return {
    article,
    versions: rows.map(({ v, by }) => ({
      id: v.id,
      savedAt: iso(v.savedAt),
      savedBy: by ?? null,
      title: v.title,
      contentHtml: v.contentHtml,
    })),
  };
}

export async function loadKbConversations(userId: string): Promise<KbConversationSummary[]> {
  const rows = await db
    .select({
      c: kbConversations,
      messages: count(kbMessages.id),
      unanswered: sql<number>`count(*) filter (where ${kbMessages.unanswered})`.mapWith(Number),
    })
    .from(kbConversations)
    .leftJoin(kbMessages, eq(kbMessages.conversationId, kbConversations.id))
    .where(eq(kbConversations.userId, userId))
    .groupBy(kbConversations.id)
    .orderBy(desc(kbConversations.updatedAt));
  return rows.map(({ c, messages, unanswered }) => ({
    id: c.id,
    title: c.title,
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
    messageCount: messages,
    unansweredCount: unanswered,
  }));
}

export async function loadKbConversation(userId: string, id: string): Promise<KbConversation | null> {
  const [c] = await db
    .select()
    .from(kbConversations)
    .where(and(eq(kbConversations.id, id), eq(kbConversations.userId, userId)));
  if (!c) return null;
  const msgs = await db
    .select()
    .from(kbMessages)
    .where(eq(kbMessages.conversationId, id))
    .orderBy(asc(kbMessages.createdAt));
  return {
    id: c.id,
    title: c.title,
    messages: msgs.map((m) => ({
      id: m.id,
      role: m.role === "user" ? "user" : "assistant",
      text: m.text,
      at: iso(m.createdAt),
      sources: m.sources ?? undefined,
      unanswered: m.unanswered || undefined,
      partial: m.outcome === "partial" || undefined,
    })),
  };
}

export async function loadKbQuestions(): Promise<KbQuestion[]> {
  const rows = await db.select().from(kbQuestions).orderBy(desc(kbQuestions.timesAsked), desc(kbQuestions.lastAskedAt));
  return rows.map((q) => ({
    id: q.id,
    question: q.question,
    firstAskedAt: iso(q.firstAskedAt),
    lastAskedAt: iso(q.lastAskedAt),
    timesAsked: q.timesAsked,
    partial: q.partial,
    status: q.status,
  }));
}

export async function loadKbUsage(): Promise<KbUsage> {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const rows = await db
    .select({ role: kbMessages.role, outcome: kbMessages.outcome, unanswered: kbMessages.unanswered, n: count() })
    .from(kbMessages)
    .where(sql`${kbMessages.createdAt} >= ${start}`)
    .groupBy(kbMessages.role, kbMessages.outcome, kbMessages.unanswered);
  const usage: KbUsage = { questions: 0, answered: 0, partial: 0, unanswered: 0, fallback: 0 };
  for (const r of rows) {
    if (r.role === "user") usage.questions += r.n;
    // Replies from before outcomes were stored only know whether they were unanswered.
    else usage[r.outcome ?? (r.unanswered ? "unanswered" : "answered")] += r.n;
  }
  return usage;
}

export async function countOpenKbQuestions(): Promise<number> {
  const [r] = await db.select({ n: count() }).from(kbQuestions).where(eq(kbQuestions.status, "open"));
  return r?.n ?? 0;
}
