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
  TicketReceipts,
  TicketReply,
  TicketStatus,
  UserTicketSummary,
} from "@/lib/tickets-model";

export type {
  Ticket,
  TicketAuthor,
  TicketReceipts,
  TicketReply,
  TicketStatus,
  UserTicketSummary,
} from "@/lib/tickets-model";

type TicketRow = typeof supportTickets.$inferSelect;

function receipts(t: TicketRow): TicketReceipts {
  return {
    lastReadByUserAt: t.lastReadByUserAt?.toISOString() ?? null,
    lastReadByAdminAt: t.lastReadByAdminAt?.toISOString() ?? null,
    lastDeliveredToUserAt: t.lastDeliveredToUserAt?.toISOString() ?? null,
    lastDeliveredToAdminAt: t.lastDeliveredToAdminAt?.toISOString() ?? null,
  };
}

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
    number: t.number,
    userId: t.userId,
    name: t.name,
    email: t.email,
    subject: t.subject,
    message: t.message,
    category: t.category,
    source: t.source,
    status: t.status,
    cancelledAt: t.cancelledAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    ...receipts(t),
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
    number: t.number,
    userId: t.userId,
    name: t.name,
    email: t.email,
    subject: t.subject,
    message: t.message,
    category: t.category,
    source: t.source,
    status: t.status,
    cancelledAt: t.cancelledAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    ...receipts(t),
    replies: replies.map(toReply),
  };
}

/** One ticket, only if it belongs to `userId` (user-side view). */
export async function getUserTicket(userId: string, ticketId: string): Promise<Ticket | null> {
  const t = await getTicket(ticketId);
  if (!t || t.userId !== userId) return null;
  return t;
}

/** The ticket's owner user id; `undefined` when the ticket doesn't exist. */
export async function getTicketOwner(ticketId: string): Promise<string | null | undefined> {
  const [t] = await db.select({ userId: supportTickets.userId }).from(supportTickets).where(eq(supportTickets.id, ticketId));
  return t ? t.userId : undefined;
}

/** A user's own tickets (summary), most-recently-active first, with unread counts. */
export async function listUserTickets(userId: string): Promise<UserTicketSummary[]> {
  const tickets = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, userId))
    .orderBy(desc(supportTickets.updatedAt));
  if (tickets.length === 0) return [];
  const replies = await db
    .select({ ticketId: ticketReplies.ticketId, author: ticketReplies.author, createdAt: ticketReplies.createdAt })
    .from(ticketReplies)
    .where(inArray(ticketReplies.ticketId, tickets.map((t) => t.id)));
  const agg = new Map(tickets.map((t) => [t.id, { count: 0, unread: 0 }]));
  const readAt = new Map(tickets.map((t) => [t.id, t.lastReadByUserAt]));
  for (const r of replies) {
    const a = agg.get(r.ticketId);
    if (!a) continue;
    a.count += 1;
    if (r.author === "admin") {
      const read = readAt.get(r.ticketId);
      if (!read || r.createdAt.getTime() > read.getTime()) a.unread += 1;
    }
  }
  return tickets.map((t) => ({
    id: t.id,
    number: t.number,
    subject: t.subject,
    category: t.category,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    replyCount: agg.get(t.id)!.count,
    unreadCount: agg.get(t.id)!.unread,
  }));
}

/** Total admin replies the user hasn't read, across all their tickets (widget badge). */
export async function userUnreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(ticketReplies)
    .innerJoin(supportTickets, eq(ticketReplies.ticketId, supportTickets.id))
    .where(
      sql`${supportTickets.userId} = ${userId} and ${ticketReplies.author} = 'admin'
          and (${supportTickets.lastReadByUserAt} is null or ${ticketReplies.createdAt} > ${supportTickets.lastReadByUserAt})`,
    );
  return row?.n ?? 0;
}

/** Tickets with unread (unseen-by-admin) user replies, as a set of ticket ids. */
export async function adminUnreadTicketIds(): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ ticketId: ticketReplies.ticketId })
    .from(ticketReplies)
    .innerJoin(supportTickets, eq(ticketReplies.ticketId, supportTickets.id))
    .where(
      sql`${ticketReplies.author} = 'user'
          and (${supportTickets.lastReadByAdminAt} is null or ${ticketReplies.createdAt} > ${supportTickets.lastReadByAdminAt})`,
    );
  return new Set(rows.map((r) => r.ticketId));
}

export async function setTicketStatus(id: string, status: TicketStatus): Promise<void> {
  await db.update(supportTickets).set({ status }).where(eq(supportTickets.id, id));
}

export async function deleteTickets(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(supportTickets).where(inArray(supportTickets.id, ids));
}

/** Mark a party's receipt (read implies delivered). Does NOT bump updatedAt.
 *  Returns the ticket owner + the timestamp so callers can publish a live event. */
export async function markTicketReceipt(
  ticketId: string,
  party: "user" | "admin",
  kind: "read" | "delivered",
): Promise<{ ownerUserId: string | null; at: string } | null> {
  const now = new Date();
  const set: Record<string, unknown> = { updatedAt: sql`${supportTickets.updatedAt}` };
  if (party === "user") {
    set.lastDeliveredToUserAt = now;
    if (kind === "read") set.lastReadByUserAt = now;
  } else {
    set.lastDeliveredToAdminAt = now;
    if (kind === "read") set.lastReadByAdminAt = now;
  }
  const [row] = await db
    .update(supportTickets)
    .set(set)
    .where(eq(supportTickets.id, ticketId))
    .returning({ userId: supportTickets.userId });
  return row ? { ownerUserId: row.userId, at: now.toISOString() } : null;
}

/** Record a reply (admin or user) and return the ticket's routing fields + the new
 *  reply row (for live events). The sender's own read-receipt is advanced. */
export async function addTicketReply(
  id: string,
  body: string,
  author: TicketAuthor = "admin",
): Promise<
  | {
      email: string;
      name: string;
      subject: string;
      userId: string | null;
      status: TicketStatus;
      reply: TicketReply;
    }
  | null
> {
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
  const now = new Date();
  // Reply is rich-text HTML — sanitize on write so it's safe to render.
  const [row] = await db
    .insert(ticketReplies)
    .values({ ticketId: id, author, body: sanitizeRichText(body), createdAt: now })
    .returning({ id: ticketReplies.id, createdAt: ticketReplies.createdAt });
  // Bump activity; the sender has read everything up to their own reply.
  const senderRead =
    author === "user"
      ? { lastReadByUserAt: now, lastDeliveredToUserAt: now }
      : { lastReadByAdminAt: now, lastDeliveredToAdminAt: now };
  await db.update(supportTickets).set({ updatedAt: now, ...senderRead }).where(eq(supportTickets.id, id));
  return {
    ...ticket,
    reply: { id: row.id, author, body: sanitizeRichText(body), createdAt: row.createdAt.toISOString() },
  };
}
