import "server-only";

// Repo knowledge base: docs/knowledge-base/**/*.md are the source of truth for
// system knowledge, updated in the same commit as the code they describe. This
// syncs them into kb_articles (the search index) at server start and from the
// admin's "Sync from repo" button. Unchanged files are skipped by hash; files
// that are gone are removed. README.md and names starting with "_" are skipped.
//
// File format: front matter, then Markdown.
//   ---
//   title: Nobody can sign in because of reCAPTCHA
//   category: Runbooks
//   summary: One or two sentences the agent leads with.
//   keywords: captcha, login, locked out
//   status: published        (optional; "draft" keeps it out of answers)
//   ---

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, notInArray } from "drizzle-orm";
import { marked } from "marked";
import { db } from "@/lib/db";
import { kbArticles } from "@/db/schema";
import { sanitizeGuideHtml } from "@/lib/guide-html";
import { KB_CATEGORIES, KB_REPO_DIR, kbHtmlToText, parseKeywords } from "@/lib/kb-model";

export interface KbFile {
  slug: string;
  title: string;
  category: string;
  summary: string;
  keywords: string[];
  status: "draft" | "published";
  contentHtml: string;
  contentText: string;
  hash: string;
}

export interface KbSyncResult {
  added: number;
  updated: number;
  unchanged: number;
  removed: number;
  errors: { file: string; error: string }[];
}

const root = () => path.join(process.cwd(), KB_REPO_DIR);

async function listFiles(dir: string, base = ""): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return []; // No folder yet: nothing to sync.
  }
  const out: string[] = [];
  for (const e of entries) {
    if (e.name.startsWith("_") || e.name.startsWith(".")) continue;
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await listFiles(path.join(dir, e.name), rel)));
    else if (e.name.endsWith(".md") && e.name.toLowerCase() !== "readme.md") out.push(rel);
  }
  return out.sort();
}

/** Parse one file, or say what's wrong with it. */
export function parseKbFile(rel: string, raw: string): KbFile | { error: string } {
  const text = raw.replace(/\r\n/g, "\n");
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!m) return { error: "missing the --- front matter block at the top" };
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([a-zA-Z]+):\s*(.*)$/.exec(line.trim());
    if (kv) meta[kv[1].toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  if (!meta.title) return { error: "front matter needs a title" };
  if (!meta.summary) return { error: "front matter needs a summary" };
  if (meta.summary.length > 240) return { error: `the summary is ${meta.summary.length} characters; keep it to 240` };
  if (!(KB_CATEGORIES as readonly string[]).includes(meta.category ?? "")) {
    return { error: `category must be one of: ${KB_CATEGORIES.join(", ")}` };
  }
  const status = (meta.status ?? "published").toLowerCase();
  if (status !== "published" && status !== "draft") return { error: 'status must be "published" or "draft"' };
  const body = m[2].trim();
  if (!body) return { error: "the article has no text" };

  const contentHtml = sanitizeGuideHtml(marked.parse(body, { async: false, gfm: true }));
  return {
    slug: rel.replace(/\.md$/, ""),
    title: meta.title.slice(0, 120),
    category: meta.category,
    summary: meta.summary,
    keywords: parseKeywords(meta.keywords ?? ""),
    status,
    contentHtml,
    contentText: kbHtmlToText(contentHtml),
    hash: createHash("sha256").update(text).digest("hex"),
  };
}

/** Bring kb_articles in line with the files. Safe to run any number of times. */
export async function syncKbFromRepo(): Promise<KbSyncResult> {
  const result: KbSyncResult = { added: 0, updated: 0, unchanged: 0, removed: 0, errors: [] };
  const files = await listFiles(root());
  const seen: string[] = [];

  for (const rel of files) {
    const parsed = parseKbFile(rel, await readFile(path.join(root(), rel), "utf8"));
    if ("error" in parsed) {
      // A broken edit keeps the last good version rather than deleting it.
      seen.push(rel.replace(/\.md$/, ""));
      result.errors.push({ file: rel, error: parsed.error });
      continue;
    }
    seen.push(parsed.slug);
    const [existing] = await db
      .select({ id: kbArticles.id, source: kbArticles.source, hash: kbArticles.contentHash })
      .from(kbArticles)
      .where(eq(kbArticles.slug, parsed.slug));
    const values = {
      title: parsed.title,
      category: parsed.category,
      summary: parsed.summary,
      keywords: parsed.keywords,
      status: parsed.status,
      contentHtml: parsed.contentHtml,
      contentText: parsed.contentText,
      contentHash: parsed.hash,
      updatedBy: null,
    };
    if (!existing) {
      await db.insert(kbArticles).values({ slug: parsed.slug, source: "repo", ...values });
      result.added++;
    } else if (existing.source !== "repo") {
      result.errors.push({ file: rel, error: "an admin article already uses this path; rename the file" });
    } else if (existing.hash === parsed.hash) {
      result.unchanged++;
    } else {
      await db.update(kbArticles).set(values).where(eq(kbArticles.id, existing.id));
      result.updated++;
    }
  }

  // Files that were deleted or renamed: their old articles go too.
  const gone = await db
    .delete(kbArticles)
    .where(
      and(
        eq(kbArticles.source, "repo"),
        seen.length ? notInArray(kbArticles.slug, seen) : undefined,
      ),
    )
    .returning({ id: kbArticles.id });
  result.removed = gone.length;
  return result;
}
