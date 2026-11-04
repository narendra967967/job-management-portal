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

export async function askKbAction(
  conversationId: string | null,
  question: string,
): Promise<{ ok: true; conversationId: string } | { ok: false; error: string }> {
  const adminId = await requireAdmin();
  const p = askSchema.safeParse({ conversationId, question });
  if (!p.success) return { ok: false, error: firstIssue(p.error) };
  const q = p.data.question;

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
    unanswered: a.unanswered,
  });
  await db.update(kbConversations).set({ updatedAt: new Date() }).where(eq(kbConversations.id, convoId));

  if (a.unanswered) {
    // The same question again counts up and reopens, instead of a new row.
    await db
      .insert(kbQuestions)
      .values({ question: q, normalized: normalizeQuestion(q) })
      .onConflictDoUpdate({
        target: kbQuestions.normalized,
        set: { timesAsked: sql`${kbQuestions.timesAsked} + 1`, lastAskedAt: new Date(), status: "open" },
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
