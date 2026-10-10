import "server-only";

// Tiny in-process pub/sub for live support chat (SSE). Server Actions publish
// events here; the SSE route handlers subscribe and push to connected clients.
//
// Single-instance only (fine for the current single EC2 box). If the app is ever
// run with more than one server instance, swap this for Redis pub/sub — the
// publish()/subscribe() surface stays the same.

import type { TicketAuthor, TicketStatus } from "@/lib/tickets-model";

export type SupportEvent =
  | {
      type: "reply";
      ticketId: string;
      ownerUserId: string | null;
      reply: { id: string; author: TicketAuthor; body: string; createdAt: string };
      /** The ticket's updated status (a user reply can reopen, etc.). */
      status: TicketStatus;
    }
  | {
      type: "receipt";
      ticketId: string;
      ownerUserId: string | null;
      // Which party's receipt changed and to what kind/time.
      party: "user" | "admin";
      kind: "read" | "delivered";
      at: string;
    }
  | {
      type: "status";
      ticketId: string;
      ownerUserId: string | null;
      status: TicketStatus;
    }
  | {
      type: "ticket";
      ticketId: string;
      ownerUserId: string | null;
    };

type Listener = (e: SupportEvent) => void;

// Survive dev HMR / multiple module evaluations by hanging the set off globalThis.
const g = globalThis as unknown as { __supportBus?: Set<Listener> };
const listeners: Set<Listener> = (g.__supportBus ??= new Set());

export function publish(e: SupportEvent): void {
  for (const fn of listeners) {
    try {
      fn(e);
    } catch {
      // never let one bad subscriber break publishing
    }
  }
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
