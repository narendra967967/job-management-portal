"use server";

// User-side support: submit a support ticket from anywhere in the app. Creates a
// ticket (admin Tickets inbox) and emails the user a confirmation. One-way — admin
// replies come back by email.

import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/current-user";
import { supportTickets } from "@/db/schema";
import {
  addTicketReply,
  createSupportTicket,
  getTicketOwner,
  getUserTicket,
  listUserTickets,
  markTicketReceipt,
  userUnreadCount,
} from "@/lib/tickets";
import { TICKET_CATEGORIES, type Ticket, type TicketReply, type UserTicketSummary } from "@/lib/tickets-model";
import { publish } from "@/lib/support-events";
import { sanitizeRichText, richTextToPlain } from "@/lib/sanitize";
import { sendAppEmail } from "@/lib/email";

type Result = { ok: true } | { ok: false; error: string };

const MAX_OPEN_PER_USER = 8;
const MAX_PER_HOUR = 5;

const schema = z.object({
  category: z.string().refine((v) => (TICKET_CATEGORIES as string[]).includes(v), "Pick a category."),
  subject: z.string().trim().min(3, "Add a short subject.").max(120),
  // Rich-text HTML; sanitized on write. Validate on the stripped-text length.
  message: z.string().max(20000).refine((v) => richTextToPlain(v).length >= 5, "Tell us a bit more about the issue."),
  source: z.string().trim().max(200).optional().default("contact"),
});

export async function submitSupportTicketAction(input: unknown): Promise<Result> {
  const u = await getSessionUser();
  if (!u) return { ok: false, error: "You're not signed in." };

  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Invalid input." };
  const v = p.data;

  // Light anti-spam: cap open requests and recent submissions per user.
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [open, recent] = await Promise.all([
    db
      .select({ id: supportTickets.id })
      .from(supportTickets)
      .where(and(eq(supportTickets.userId, u.id), eq(supportTickets.status, "open"))),
    db
      .select({ id: supportTickets.id })
      .from(supportTickets)
      .where(and(eq(supportTickets.userId, u.id), gt(supportTickets.createdAt, hourAgo))),
  ]);
  if (recent.length >= MAX_PER_HOUR) {
    return { ok: false, error: "You've sent several requests recently — please wait a bit before sending more." };
  }
  if (open.length >= MAX_OPEN_PER_USER) {
    return { ok: false, error: "You already have several open requests — we'll get back to you soon." };
  }

  const ticketId = await createSupportTicket({
    userId: u.id,
    name: u.name,
    email: u.email,
    subject: v.subject,
    message: v.message,
    category: v.category,
    source: v.source,
  });
  // Live: surface the new ticket in the admin inbox.
  publish({ type: "ticket", ticketId, ownerUserId: u.id });

  // Confirmation email (best-effort — the ticket is already filed).
  try {
    const safeHtml = sanitizeRichText(v.message);
    await sendAppEmail({
      to: u.email,
      subject: `We got your request: ${v.subject}`,
      heading: "Thanks — we've received your request",
      bodyHtml: `<p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#374151;">Our team will review it and reply from your account. You can follow the conversation anytime under <strong>Settings &rarr; Help &amp; support</strong>.</p>
        <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;"><strong>Your message</strong></p>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#374151;">${safeHtml}</div>`,
      text: `Thanks — we've received your request. Follow the conversation under Settings → Help & support.\n\nYour message:\n${richTextToPlain(v.message)}`,
      footerNote: "You're receiving this because you contacted support from your account.",
    });
  } catch {
    // Non-fatal: the ticket is filed regardless.
  }

  return { ok: true };
}

/** The signed-in user's own tickets (for Settings → Help & support). */
export async function listMyTicketsAction(): Promise<
  { ok: true; tickets: UserTicketSummary[] } | { ok: false; error: string }
> {
  const u = await getSessionUser();
  if (!u) return { ok: false, error: "You're not signed in." };
  const tickets = await listUserTickets(u.id);
  return { ok: true, tickets };
}

const replySchema = z.object({
  ticketId: z.string().uuid(),
  body: z.string().max(20000).refine((v) => richTextToPlain(v).length >= 1, "Write a reply."),
});

type ReplyResult = { ok: true; reply: TicketReply } | { ok: false; error: string };

/** Reply to one of the user's own tickets. Blocked once the ticket is resolved. */
export async function replyToMyTicketAction(input: unknown): Promise<ReplyResult> {
  const u = await getSessionUser();
  if (!u) return { ok: false, error: "You're not signed in." };

  const p = replySchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Invalid reply." };

  // Must be the user's own ticket, and not already resolved.
  const ticket = await getUserTicket(u.id, p.data.ticketId);
  if (!ticket) return { ok: false, error: "Ticket not found." };
  if (ticket.status === "resolved") {
    return { ok: false, error: "This request is resolved. Please raise a new one to continue." };
  }

  const res = await addTicketReply(p.data.ticketId, p.data.body, "user");
  if (!res) return { ok: false, error: "Ticket not found." };
  // Admin works from the inbox (the reply bumps updatedAt) — no email to support.
  publish({ type: "reply", ticketId: p.data.ticketId, ownerUserId: u.id, reply: res.reply, status: res.status });
  revalidatePath(`/support/${p.data.ticketId}`);
  return { ok: true, reply: res.reply };
}

/** One of the user's own tickets with its full thread (for the widget). */
export async function getMyTicketAction(
  ticketId: unknown,
): Promise<{ ok: true; ticket: Ticket } | { ok: false; error: string }> {
  const u = await getSessionUser();
  if (!u) return { ok: false, error: "You're not signed in." };
  const p = z.string().uuid().safeParse(ticketId);
  if (!p.success) return { ok: false, error: "Invalid request." };
  const ticket = await getUserTicket(u.id, p.data);
  if (!ticket) return { ok: false, error: "Ticket not found." };
  return { ok: true, ticket };
}

/** Mark a ticket's admin messages read / delivered for the signed-in user. */
async function userReceipt(ticketId: unknown, kind: "read" | "delivered"): Promise<Result> {
  const u = await getSessionUser();
  if (!u) return { ok: false, error: "You're not signed in." };
  const p = z.string().uuid().safeParse(ticketId);
  if (!p.success) return { ok: false, error: "Invalid request." };
  if ((await getTicketOwner(p.data)) !== u.id) return { ok: false, error: "Ticket not found." };
  const r = await markTicketReceipt(p.data, "user", kind);
  if (r) publish({ type: "receipt", ticketId: p.data, ownerUserId: r.ownerUserId, party: "user", kind, at: r.at });
  return { ok: true };
}

export async function markMyTicketReadAction(ticketId: unknown): Promise<Result> {
  return userReceipt(ticketId, "read");
}

export async function markMyTicketDeliveredAction(ticketId: unknown): Promise<Result> {
  return userReceipt(ticketId, "delivered");
}

/** Total unread admin replies across the user's tickets (widget badge on load). */
export async function myUnreadCountAction(): Promise<number> {
  const u = await getSessionUser();
  if (!u) return 0;
  return userUnreadCount(u.id);
}
