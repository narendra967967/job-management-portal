// Shared ticket types + labels (safe to import from client or server). The DB
// access lives in lib/tickets.ts (server-only).

export type TicketStatus = "open" | "in_progress" | "resolved";

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

export type TicketCategory = "question" | "bug" | "billing" | "account" | "other" | "deletion";

/** Categories a user can pick in the contact forms. "deletion" is only created
 *  by Settings → Account → Request account deletion. */
export const TICKET_CATEGORIES: TicketCategory[] = ["question", "bug", "billing", "account", "other"];

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  question: "Question",
  bug: "Bug / problem",
  billing: "Billing",
  account: "Account",
  other: "Other",
  deletion: "Account deletion",
};

export type TicketAuthor = "user" | "admin";

/** Human-readable ticket reference from the sequential number, e.g. TKT-0042. */
export function ticketRef(n: number): string {
  return `TKT-${String(n).padStart(4, "0")}`;
}

export interface TicketReply {
  id: string;
  /** Who wrote it: "user" (the ticket owner) or "admin" (support). */
  author: TicketAuthor;
  body: string;
  createdAt: string;
}

/** Read/delivery receipts for a ticket (drives chat ticks + unread counts). */
export interface TicketReceipts {
  lastReadByUserAt: string | null;
  lastReadByAdminAt: string | null;
  lastDeliveredToUserAt: string | null;
  lastDeliveredToAdminAt: string | null;
}

export type TickState = "sent" | "delivered" | "read";

/** Tick state for one message, derived from the ticket's receipts. The recipient is
 *  the OTHER party, so a message is read/delivered once that party's receipt time
 *  reaches the message. Only the sender shows ticks on their own messages. */
export function messageTick(
  author: TicketAuthor,
  messageAt: string,
  r: TicketReceipts,
): TickState {
  const recipientIsUser = author === "admin";
  const readAt = recipientIsUser ? r.lastReadByUserAt : r.lastReadByAdminAt;
  const deliveredAt = recipientIsUser ? r.lastDeliveredToUserAt : r.lastDeliveredToAdminAt;
  const at = new Date(messageAt).getTime();
  if (readAt && new Date(readAt).getTime() >= at) return "read";
  if (deliveredAt && new Date(deliveredAt).getTime() >= at) return "delivered";
  return "sent";
}

/** Lightweight row for the user's own ticket list (Settings → Help & support). */
export interface UserTicketSummary {
  id: string;
  number: number;
  subject: string;
  category: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  replyCount: number;
  /** Admin replies the user hasn't read yet. */
  unreadCount: number;
}

export interface Ticket extends TicketReceipts {
  id: string;
  number: number;
  userId: string | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  category: string;
  source: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  replies: TicketReply[];
}
