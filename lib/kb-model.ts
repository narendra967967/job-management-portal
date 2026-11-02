// Admin knowledge base: shared types and labels (client-safe). Admin only, by
// design: nothing here is ever shown on the user side.

export type KbArticleStatus = "draft" | "published";

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

export interface KbArticleVersion {
  id: string;
  savedAt: string;
  savedBy: string;
  title: string;
  contentHtml: string;
}

export interface KbArticle {
  id: string;
  title: string;
  category: KbCategory;
  /** One line the agent can quote, and the list shows. */
  summary: string;
  /** Extra words people might search with ("login" for a sign-in article). */
  keywords: string[];
  status: KbArticleStatus;
  contentHtml: string;
  updatedAt: string;
  updatedBy: string;
  /** Earlier saves, newest first. */
  versions: KbArticleVersion[];
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

export interface KbConversation {
  id: string;
  /** The first question, shortened. */
  title: string;
  createdAt: string;
  updatedAt: string;
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

/** Keywords typed as "a, b, c". */
export function parseKeywords(raw: string): string[] {
  return [...new Set(raw.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
}

export const kbHtmlToText = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
