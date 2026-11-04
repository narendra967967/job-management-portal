import "server-only";

// Knowledge base search: the published articles, plus the live How-to guides,
// that best match a question. Postgres full-text search, so word forms match
// ("discarding" finds "discard") and filler words are ignored. Kept behind this
// one function so a vector search could replace it without touching callers.
//
// A question rarely uses every word an article does, so a hit needs ANY of the
// question's terms, ranked by which it covers and where. A rare term ("logo")
// says far more than one most articles share ("app", "change"), so each term
// weighs by how few articles contain it, and counts extra in a title, keywords
// or summary. A hit only counts when it covers
// enough of the question (see `counts`), which is how "not in the knowledge
// base" is decided. A term no article contains at all ("refund") is a sign the
// topic isn't covered, so it raises the bar.
//
// No stored search column: Postgres won't index array_to_string(keywords), and
// at this size computing the vectors per query is instant.

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export type KbHitKind = "article" | "guide";

export interface KbHit {
  kind: KbHitKind;
  id: string;
  title: string;
  summary: string;
  contentText: string;
  /** Where an admin opens it. */
  href: string;
  /** How well it answers: rare terms weigh most, more so in a title, keywords or summary. */
  weight: number;
  /** Postgres rank, for ordering among equal weight. */
  score: number;
  /** The question's terms found anywhere in it; in its title, keywords or summary; in its title. */
  matched: string[];
  strong: string[];
  titled: string[];
}

/** The question's search terms: stemmed, filler words removed. */
async function questionTerms(question: string): Promise<string[]> {
  const r = await db.execute(
    sql`select array(select lexeme from unnest(to_tsvector('english', ${question}))) as terms`,
  );
  const rows = (r as unknown as { rows: { terms: string[] }[] }).rows;
  return (rows[0]?.terms ?? []).filter((t) => /^[\p{L}\p{N}-]+$/u.test(t)).slice(0, 30);
}

/**
 * Enough of the question is covered: at least half its terms (three quarters
 * when a term appears in no article at all), at least one of them in a title,
 * keywords or summary, and two terms once the question has three or more.
 */
function counts(hit: KbHit, terms: number, unknown: number): boolean {
  const m = hit.matched.length;
  const share = unknown > 0 ? 0.75 : 0.5;
  return m / terms >= share && hit.strong.length >= 1 && (terms <= 2 ? m >= 1 : m >= 2);
}

export async function searchKb(question: string, limit = 3): Promise<KbHit[]> {
  const terms = await questionTerms(question);
  if (!terms.length) return [];
  const arr = sql`ARRAY[${sql.join(
    terms.map((t) => sql`${t}`),
    sql`, `,
  )}]::text[]`;
  const anyTerm = terms.map((t) => `'${t}'`).join(" | ");

  const r = await db.execute(sql`
    with docs as (
      select 'article' as kind, id::text as id, title, summary, content_text as body,
        setweight(to_tsvector('english', title), 'A') ||
        setweight(to_tsvector('english', array_to_string(keywords, ' ')), 'B') ||
        setweight(to_tsvector('english', summary), 'B') ||
        setweight(to_tsvector('english', content_text), 'C') as doc
      from kb_articles where status = 'published'
      union all
      select 'guide', id::text, title, summary,
        regexp_replace(content_html, '<[^>]+>', ' ', 'g'),
        setweight(to_tsvector('english', title), 'A') ||
        setweight(to_tsvector('english', summary), 'B') ||
        setweight(to_tsvector('english', regexp_replace(content_html, '<[^>]+>', ' ', 'g')), 'C')
      from guide_topics where status = 'active'
    ),
    stats as (
      select (select count(*) from docs)::int as n,
        array(
          select (select count(*) from docs where doc @@ quote_literal(t)::tsquery)::int
          from unnest(${arr}) with ordinality u(t, i) order by i
        ) as df
    )
    select kind, id, title, summary, body, (select n from stats) as n, (select df from stats) as df,
      ts_rank(doc, ${anyTerm}::tsquery) as score,
      array(select t from unnest(${arr}) t where doc @@ quote_literal(t)::tsquery) as matched,
      array(select t from unnest(${arr}) t where doc @@ (quote_literal(t) || ':AB')::tsquery) as strong,
      array(select t from unnest(${arr}) t where doc @@ (quote_literal(t) || ':A')::tsquery) as titled
    from docs
    where doc @@ ${anyTerm}::tsquery
  `);
  const rows = (r as unknown as {
    rows: {
      kind: KbHitKind;
      id: string;
      title: string;
      summary: string;
      body: string;
      n: number;
      df: number[];
      score: number;
      matched: string[];
      strong: string[];
      titled: string[];
    }[];
  }).rows;

  if (!rows.length) return [];
  // How many articles hold each term, as a weight: 1 for a term in every one.
  const { n, df } = rows[0];
  const idf = new Map(terms.map((t, i) => [t, Math.log((n + 1) / Math.max(df[i], 1))]));
  const sum = (ts: string[]) => ts.reduce((a, t) => a + (idf.get(t) ?? 0), 0);
  const unknown = df.filter((d) => d === 0).length;
  return rows
    .map((row) => ({
      kind: row.kind,
      id: row.id,
      title: row.title,
      summary: row.summary,
      contentText: row.body.replace(/\s+/g, " ").trim(),
      href: row.kind === "guide" ? `/jmp-admin/guides/${row.id}` : `/jmp-admin/knowledge-base/articles/${row.id}`,
      weight: sum(row.matched) + sum(row.strong) * 0.5 + sum(row.titled) * 0.25,
      score: Number(row.score),
      matched: row.matched,
      strong: row.strong,
      titled: row.titled,
    }))
    .filter((h) => counts(h, terms.length, unknown))
    .sort((a, b) => b.weight - a.weight || b.score - a.score)
    .slice(0, limit);
}
