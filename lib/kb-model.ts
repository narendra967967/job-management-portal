// Admin knowledge base: shared types, labels and limits (client-safe). Admin
// only, by design: nothing here is ever shown on the user side.

import { z } from "zod";

export type KbArticleStatus = "draft" | "published";
/** `repo`: from docs/knowledge-base (read-only in the admin). `admin`: written in the admin. */
export type KbArticleSource = "repo" | "admin";

export const KB_CATEGORIES = [
  "Leads and automation",
  "Email forwarding",
  "AI",
  "Plans and billing",
  "Users and support",
  "Settings and data",
  "Runbooks",
] as const;
export type KbCategory = (typeof KB_CATEGORIES)[number];

/** Where repo articles live, relative to the project root. */
export const KB_REPO_DIR = "docs/knowledge-base";

export interface KbArticle {
  id: string;
  /** Repo: file path without .md. */
  slug: string;
  source: KbArticleSource;
  title: string;
  category: string;
  /** One or two sentences the agent leads with. */
  summary: string;
  /** Extra words people might search with ("login" for a sign-in article). */
  keywords: string[];
  status: KbArticleStatus;
  contentHtml: string;
  updatedAt: string;
  /** Admin's name; null for repo articles. */
  updatedBy: string | null;
}

export interface KbArticleVersion {
  id: string;
  savedAt: string;
  savedBy: string | null;
  title: string;
  contentHtml: string;
}

export interface KbSource {
  id: string;
  title: string;
}

export interface KbMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
  /** Articles the answer came from. */
  sources?: KbSource[];
  /** The agent found nothing to answer with. */
  unanswered?: boolean;
}

export interface KbConversationSummary {
  id: string;
  /** The first question, shortened. */
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  unansweredCount: number;
}

export interface KbConversation {
  id: string;
  title: string;
  messages: KbMessage[];
}

export type KbQuestionStatus = "open" | "covered" | "dismissed";

export interface KbQuestion {
  id: string;
  question: string;
  firstAskedAt: string;
  lastAskedAt: string;
  timesAsked: number;
  status: KbQuestionStatus;
}

export const KB_QUESTION_STATUS_LABELS: Record<KbQuestionStatus, string> = {
  open: "Open",
  covered: "Covered",
  dismissed: "Dismissed",
};

export const KB_QUESTION_MAX = 500;

/** Keywords typed as "a, b, c". */
export function parseKeywords(raw: string): string[] {
  return [...new Set(raw.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
}

/** "The same question": lowercased, spaces collapsed, trailing punctuation dropped. */
export function normalizeQuestion(q: string): string {
  return q.toLowerCase().replace(/\s+/g, " ").replace(/[\s?.!]+$/, "").trim();
}

export const kbHtmlToText = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** An admin-written article, as the editor sends it. */
export const kbArticleInputSchema = z.object({
  title: z.string().trim().min(1, "Add a title.").max(120, "Keep the title under 120 characters."),
  category: z.enum(KB_CATEGORIES, { message: "Pick a category." }),
  summary: z
    .string()
    .trim()
    .min(1, "Add a one-line summary. The agent uses it in answers.")
    .max(240, "Keep the summary under 240 characters."),
  keywords: z.array(z.string().trim().min(1).max(40)).max(20),
  status: z.enum(["draft", "published"]),
  contentHtml: z.string().max(200_000, "This article is too long."),
});
export type KbArticleInput = z.infer<typeof kbArticleInputSchema>;
