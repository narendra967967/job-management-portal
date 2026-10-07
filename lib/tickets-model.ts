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

export interface TicketReply {
  id: string;
  body: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
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
