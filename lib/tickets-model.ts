// Shared ticket types + labels (safe to import from client or server). The DB
// access lives in lib/tickets.ts (server-only).

export type TicketStatus = "open" | "in_progress" | "resolved";

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
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
  source: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  replies: TicketReply[];
}
