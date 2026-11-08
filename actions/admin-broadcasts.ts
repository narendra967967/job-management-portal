"use server";

// Admin broadcasts. Every action checks for an admin session and validates its
// input. A broadcast can change only until it starts; after that it's a record
// of what went out. Sending is lib/broadcasts-send.ts: "Send now" queues the
// broadcast for this moment and runs the sender straight after responding;
// Schedule queues it for later, and the cron picks it up.

import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/current-user";
import { broadcastRecipients, broadcasts, user } from "@/db/schema";
import { sanitizeGuideHtml } from "@/lib/guide-html";
import { sendAppEmail, SMTP_NOT_CONFIGURED } from "@/lib/email";
import { getAppName } from "@/lib/branding";
import { runBroadcasts } from "@/lib/broadcasts-send";
import {
  BROADCAST_HTML_MAX,
  BROADCAST_TITLE_MAX,
  broadcastInputSchema,
  type BroadcastInput,
} from "@/lib/broadcasts-model";

type Result = { ok: true } | { ok: false; error: string };

const zId = z.string().uuid();
const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid input.";
const STARTED = "This broadcast has already started, so it can't change. Duplicate it to send something similar.";

const revalidate = (id?: string) => {
  revalidatePath("/jmp-admin/broadcasts");
  if (id) revalidatePath(`/jmp-admin/broadcasts/${id}`);
};

/** A draft only needs a title; everything else is checked when it's sent. */
const draftSchema = z.object({
  title: z.string().trim().min(1, "Give it a title so you can find the draft later.").max(BROADCAST_TITLE_MAX),
  contentHtml: z.string().max(BROADCAST_HTML_MAX, "The message is too long for an email."),
  category: z.enum(["important", "promotional"]),
  channel: z.enum(["in_app", "email", "both"]),
  scheduledFor: z.null(),
});

async function editable(id: string) {
  const [b] = await db.select({ status: broadcasts.status }).from(broadcasts).where(eq(broadcasts.id, id));
  if (!b) return { ok: false as const, error: "That broadcast doesn't exist anymore." };
  if (b.status !== "draft" && b.status !== "scheduled") return { ok: false as const, error: STARTED };
  return { ok: true as const };
}

export async function saveBroadcastAction(
  id: string | null,
  input: BroadcastInput,
  mode: "draft" | "send",
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const adminId = await requireAdmin();
  if (id !== null && !zId.safeParse(id).success) return { ok: false, error: "That broadcast doesn't exist anymore." };
  const p = (mode === "draft" ? draftSchema : broadcastInputSchema).safeParse(input);
  if (!p.success) return { ok: false, error: firstIssue(p.error) };
  const v = p.data;

  const sendingNow = mode === "send" && !v.scheduledFor;
  const kick = () => {
    if (!sendingNow) return;
    after(() =>
      runBroadcasts().catch((e) => console.error("[broadcasts] send failed:", e instanceof Error ? e.message : e)),
    );
  };

  const values = {
    title: v.title.trim(),
    contentHtml: sanitizeGuideHtml(v.contentHtml),
    category: v.category,
    channel: v.channel,
    status: mode === "draft" ? ("draft" as const) : ("scheduled" as const),
    // Send now queues it for this moment; the worker sends anything due.
    scheduledFor: mode === "draft" ? null : v.scheduledFor ? new Date(v.scheduledFor) : new Date(),
  };

  if (id) {
    const e = await editable(id);
    if (!e.ok) return e;
    // Only while still unstarted, so a send racing the worker can't be rewritten.
    const done = await db
      .update(broadcasts)
      .set(values)
      .where(and(eq(broadcasts.id, id), inArray(broadcasts.status, ["draft", "scheduled"])))
      .returning({ id: broadcasts.id });
    if (!done.length) return { ok: false, error: STARTED };
    revalidate(id);
    kick();
    return { ok: true, id };
  }
  const [created] = await db.insert(broadcasts).values({ ...values, createdBy: adminId }).returning({ id: broadcasts.id });
  revalidate(created.id);
  kick();
  return { ok: true, id: created.id };
}

/** Stops a scheduled send, or the emails still waiting in one that's going out. */
export async function cancelBroadcastAction(id: string): Promise<Result> {
  await requireAdmin();
  if (!zId.safeParse(id).success) return { ok: false, error: "That broadcast doesn't exist anymore." };
  const now = new Date();
  const done = await db
    .update(broadcasts)
    .set({ status: "canceled", canceledAt: now })
    .where(and(eq(broadcasts.id, id), inArray(broadcasts.status, ["scheduled", "sending"])))
    .returning({ id: broadcasts.id });
  if (!done.length) return { ok: false, error: "It has already finished or been canceled." };
  // Emails still in the queue won't go out; ones already sent stay sent.
  await db
    .update(broadcastRecipients)
    .set({ status: "skipped", lastError: "Canceled before it was sent" })
    .where(and(eq(broadcastRecipients.broadcastId, id), eq(broadcastRecipients.status, "pending")));
  revalidate(id);
  return { ok: true };
}

/** Drafts, and canceled sends that never started. Anything that reached users stays on record. */
export async function deleteBroadcastAction(id: string): Promise<Result> {
  await requireAdmin();
  if (!zId.safeParse(id).success) return { ok: false, error: "That broadcast doesn't exist anymore." };
  const done = await db
    .delete(broadcasts)
    .where(
      and(
        eq(broadcasts.id, id),
        or(eq(broadcasts.status, "draft"), and(eq(broadcasts.status, "canceled"), isNull(broadcasts.startedAt))),
      ),
    )
    .returning({ id: broadcasts.id });
  if (!done.length) return { ok: false, error: "Only drafts and sends canceled before they started can be deleted." };
  revalidate();
  return { ok: true };
}

/** A new draft with the same content, for resending or reusing a message. */
export async function duplicateBroadcastAction(id: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const adminId = await requireAdmin();
  if (!zId.safeParse(id).success) return { ok: false, error: "That broadcast doesn't exist anymore." };
  const [src] = await db.select().from(broadcasts).where(eq(broadcasts.id, id));
  if (!src) return { ok: false, error: "That broadcast doesn't exist anymore." };
  const [copy] = await db
    .insert(broadcasts)
    .values({
      title: `${src.title} (copy)`.slice(0, BROADCAST_TITLE_MAX),
      contentHtml: src.contentHtml,
      category: src.category,
      channel: src.channel,
      createdBy: adminId,
    })
    .returning({ id: broadcasts.id });
  revalidate(copy.id);
  return { ok: true, id: copy.id };
}

/** Emails the broadcast as it stands to the signed-in admin, marked as a test. */
export async function sendTestBroadcastAction(input: BroadcastInput): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  const adminId = await requireAdmin();
  const p = broadcastInputSchema.safeParse({ ...input, scheduledFor: null });
  if (!p.success) return { ok: false, error: firstIssue(p.error) };
  const [me] = await db.select({ email: user.email }).from(user).where(eq(user.id, adminId));
  if (!me) return { ok: false, error: "Couldn't find your account's email." };
  const appName = await getAppName();
  try {
    await sendAppEmail({
      to: me.email,
      subject: `[Test] ${p.data.title}`,
      heading: p.data.title,
      bodyHtml: sanitizeGuideHtml(p.data.contentHtml),
      footerNote:
        p.data.category === "promotional"
          ? `You're getting this because you have a ${appName} account. The real email has an unsubscribe link here.`
          : `This is a service message about your ${appName} account, so it can't be turned off.`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === SMTP_NOT_CONFIGURED) return { ok: false, error: "Email isn't set up yet. Set it up in Settings → Email delivery." };
    console.error("[broadcasts] test send failed:", msg);
    return { ok: false, error: "The test email didn't send. Check Settings → Email delivery." };
  }
  return { ok: true, to: me.email };
}
