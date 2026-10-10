// Shared ticket types + labels (safe to import from client or server). The DB
// access lives in lib/tickets.ts (server-only).

export type TicketStatus = "open" | "in_progress" | "resolved";

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

export type TicketCategory = "question" | "bug" | "billing" | "account" | "other";

export const TICKET_CATEGORIES: TicketCategory[] = ["question", "bug", "billing", "account", "other"];

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  question: "Question",
  bug: "Bug / problem",
  billing: "Billing",
  account: "Account",
  other: "Other",
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
}

export interface Ticket {
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
