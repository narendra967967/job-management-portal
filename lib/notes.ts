import "server-only";

// Personal notepad storage — one sanitized rich-text document per user
// (user_notes). Shared by the user-app actions (premium-gated) and the admin
// actions (admins always have it). Callers resolve and authorize the user.

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userNotes } from "@/db/schema";
import { richTextToPlain, sanitizeRichText } from "@/lib/sanitize";

/** Visible-text limit (what the counter shows). */
export const NOTES_MAX_CHARS = 20_000;
/** Hard cap on the stored HTML (markup overhead included). */
const NOTES_MAX_HTML = 200_000;

export interface NotesDoc {
  content: string;
  /** ISO, or null when nothing has been saved yet. */
  updatedAt: string | null;
}

export async function readNotes(userId: string): Promise<NotesDoc> {
  const [row] = await db
    .select({ content: userNotes.content, updatedAt: userNotes.updatedAt })
    .from(userNotes)
    .where(eq(userNotes.userId, userId));
  return {
    content: row?.content ?? "",
    updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

/** Validate + sanitize, then upsert. Throws a friendly Error on bad input. */
export async function writeNotes(userId: string, rawHtml: unknown): Promise<NotesDoc> {
  if (typeof rawHtml !== "string") throw new Error("Invalid notes.");
  if (rawHtml.length > NOTES_MAX_HTML) {
    throw new Error("Your notes are too large to save. Remove some formatting or text.");
  }
  const content = sanitizeRichText(rawHtml);
  const chars = richTextToPlain(content).length;
  if (chars > NOTES_MAX_CHARS) {
    throw new Error(
      `Notes can be up to ${NOTES_MAX_CHARS.toLocaleString("en-IN")} characters (you have ${chars.toLocaleString("en-IN")}).`,
    );
  }
  const now = new Date();
  await db
    .insert(userNotes)
    .values({ userId, content, updatedAt: now })
    .onConflictDoUpdate({ target: userNotes.userId, set: { content, updatedAt: now } });
  return { content, updatedAt: now.toISOString() };
}
