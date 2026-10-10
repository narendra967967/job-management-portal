import "server-only";

// Support tickets — the sink for user support messages and the admin Tickets inbox.
// Two-way: replies carry an author ("user" | "admin"). createSupportTicket is the
// single entry point any user-side page can call to raise a ticket.

import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { supportTickets, ticketReplies } from "@/db/schema";
import { sanitizeRichText } from "@/lib/sanitize";
import type {
  Ticket,
  TicketAuthor,
  TicketReply,
  TicketStatus,
  UserTicketSummary,
} from "@/lib/tickets-model";

export type {
  Ticket,
  TicketAuthor,
  TicketReply,
  TicketStatus,
  UserTicketSummary,
} from "@/lib/tickets-model";

/** Raise a support ticket. Returns the new ticket id. */
export async function createSupportTicket(input: {
  userId?: string | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  category?: string;
  source: string;
}): Promise<string> {
  const [row] = await db
    .insert(supportTickets)
    .values({
      userId: input.userId ?? null,
      name: input.name,
      email: input.email,
      subject: input.subject,
      // Message is rich-text HTML — sanitize on write so it's safe to render.
      message: sanitizeRichText(input.message),
      category: input.category ?? "other",
      source: input.source,
    })
    .returning({ id: supportTickets.id });
  return row.id;
}

function toReply(r: typeof ticketReplies.$inferSelect): TicketReply {
  return {
    id: r.id,
    author: (r.author === "user" ? "user" : "admin") as TicketAuthor,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
  };
}

/** All tickets with their replies, newest first (admin inbox). */
export async function listTickets(): Promise<Ticket[]> {
  const [tickets, replies] = await Promise.all([
    db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt)),
    db.select().from(ticketReplies).orderBy(asc(ticketReplies.createdAt)),
  ]);
  const repliesByTicket = new Map<string, TicketReply[]>();
  for (const r of replies) {
    const list = repliesByTicket.get(r.ticketId) ?? [];
    list.push(toReply(r));
    repliesByTicket.set(r.ticketId, list);
  }
  return tickets.map((t) => ({
    id: t.id,
    userId: t.userId,
    name: t.name,
    email: t.email,
    subject: t.subject,
    message: t.message,
    category: t.category,
    source: t.source,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    replies: repliesByTicket.get(t.id) ?? [],
  }));
}

/** One ticket with its replies (for the detail view and the resolved email). */
export async function getTicket(id: string): Promise<Ticket | null> {
  const [t] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
  if (!t) return null;
  const replies = await db
    .select()
    .from(ticketReplies)
    .where(eq(ticketReplies.ticketId, id))
    .orderBy(asc(ticketReplies.createdAt));
  return {
    id: t.id,
    userId: t.userId,
    name: t.name,
    email: t.email,
    subject: t.subject,
    message: t.message,
    category: t.category,
    source: t.source,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    replies: replies.map(toReply),
  };
}

/** One ticket, only if it belongs to `userId` (user-side view). */
export async function getUserTicket(userId: string, ticketId: string): Promise<Ticket | null> {
  const t = await getTicket(ticketId);
  if (!t || t.userId !== userId) return null;
  return t;
}

/** A user's own tickets (summary), most-recently-active first. */
export async function listUserTickets(userId: string): Promise<UserTicketSummary[]> {
  const tickets = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, userId))
    .orderBy(desc(supportTickets.updatedAt));
  if (tickets.length === 0) return [];
  const counts = await db
    .select({ ticketId: ticketReplies.ticketId, n: sql<number>`count(*)::int` })
    .from(ticketReplies)
    .where(inArray(ticketReplies.ticketId, tickets.map((t) => t.id)))
    .groupBy(ticketReplies.ticketId);
  const replyCount = new Map(counts.map((c) => [c.ticketId, c.n]));
  return tickets.map((t) => ({
    id: t.id,
    subject: t.subject,
    category: t.category,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    replyCount: replyCount.get(t.id) ?? 0,
  }));
}

export async function setTicketStatus(id: string, status: TicketStatus): Promise<void> {
  await db.update(supportTickets).set({ status }).where(eq(supportTickets.id, id));
}

export async function deleteTickets(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(supportTickets).where(inArray(supportTickets.id, ids));
}

/** Record a reply (admin or user) and return the ticket's routing fields. */
export async function addTicketReply(
  id: string,
  body: string,
  author: TicketAuthor = "admin",
): Promise<{ email: string; name: string; subject: string; userId: string | null; status: TicketStatus } | null> {
  const [ticket] = await db
    .select({
      email: supportTickets.email,
      name: supportTickets.name,
      subject: supportTickets.subject,
      userId: supportTickets.userId,
      status: supportTickets.status,
    })
    .from(supportTickets)
    .where(eq(supportTickets.id, id));
  if (!ticket) return null;
  // Reply is rich-text HTML — sanitize on write so it's safe to render.
  await db.insert(ticketReplies).values({ ticketId: id, author, body: sanitizeRichText(body) });
  await db.update(supportTickets).set({ updatedAt: new Date() }).where(eq(supportTickets.id, id));
  return ticket;
}
