import "server-only";

// Knowledge base search: the published articles that best match a question.
// Kept behind this one function on purpose. For now it's simple word matching
// (title and keywords weigh more than body text); Phase 4 swaps in Postgres
// full-text search, and vectors could follow, without touching the callers.

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { kbArticles } from "@/db/schema";

export interface KbHit {
  id: string;
  title: string;
  summary: string;
  contentText: string;
  score: number;
}

const STOP = new Set(
  "a an and are as at be but by can do does for from how i if in is it its me my of on or so that the this to was what when where which who why will with you your".split(" "),
);
const words = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => w.length > 2 && !STOP.has(w)) ?? [];

export async function searchKb(question: string, limit = 3): Promise<KbHit[]> {
  const q = words(question);
  if (!q.length) return [];
  const rows = await db
    .select({
      id: kbArticles.id,
      title: kbArticles.title,
      summary: kbArticles.summary,
      keywords: kbArticles.keywords,
      contentText: kbArticles.contentText,
    })
    .from(kbArticles)
    .where(eq(kbArticles.status, "published"));
  return rows
    .map((a) => {
      const title = new Set(words(a.title));
      const keys = new Set(words(a.keywords.join(" ")));
      const body = new Set(words(`${a.summary} ${a.contentText}`));
      const score = q.reduce(
        (n, w) => n + (title.has(w) ? 3 : 0) + (keys.has(w) ? 3 : 0) + (body.has(w) ? 1 : 0),
        0,
      );
      return { id: a.id, title: a.title, summary: a.summary, contentText: a.contentText, score };
    })
    .filter((h) => h.score >= 3)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}
