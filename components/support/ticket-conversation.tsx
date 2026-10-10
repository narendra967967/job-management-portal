"use client";

// User-side ticket conversation — a chat view of one of the user's own tickets.
// Original message + replies in chronological order (user right, support left),
// with a reply box below. Replies are disabled once the ticket is resolved.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LifeBuoy } from "lucide-react";
import { RichText } from "@/components/ui/rich-text";
import { Button } from "@/components/ui/button";
import { useContactSupport } from "@/components/support/contact-support";
import { TicketStatusPill } from "@/components/support/ticket-status-pill";
import { richTextToPlain } from "@/lib/sanitize";
import { replyToMyTicketAction } from "@/actions/support";
import {
  TICKET_CATEGORY_LABELS,
  type Ticket,
  type TicketCategory,
} from "@/lib/tickets-model";
import { cn, formatDateTime } from "@/lib/utils";

const proseCls =
  "text-sm [&_li]:ml-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5";

// Timestamps format in the viewer's locale/timezone, which the server can't know —
// render them client-only to avoid a hydration mismatch.
function Time({ iso, className }: { iso: string; className?: string }) {
  const [text, setText] = useState("");
  useEffect(() => setText(formatDateTime(iso)), [iso]);
  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}

export function TicketConversation({ ticket }: { ticket: Ticket }) {
  const router = useRouter();
  const { open: openSupport } = useContactSupport();
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const resolved = ticket.status === "resolved";

  // Original message is the user's first message; then replies in order.
  const messages = [
    { id: "message", author: "user" as const, body: ticket.message, at: ticket.createdAt },
    ...ticket.replies.map((r) => ({ id: r.id, author: r.author, body: r.body, at: r.createdAt })),
  ];

  async function send() {
    if (!richTextToPlain(reply).trim() || busy) return;
    setBusy(true);
    setError("");
    const res = await replyToMyTicketAction({ ticketId: ticket.id, body: reply });
    setBusy(false);
    if (res.ok) {
      setReply("");
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  const category = TICKET_CATEGORY_LABELS[ticket.category as TicketCategory] ?? ticket.category;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Help &amp; support
      </Link>

      {/* Header */}
      <div className="rounded-2xl border bg-card p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 text-lg leading-snug font-medium">{ticket.subject}</h1>
          <TicketStatusPill status={ticket.status} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {category} · opened <Time iso={ticket.createdAt} />
        </p>
      </div>

      {/* Conversation */}
      <div className="space-y-3">
        {messages.map((m) => {
          const mine = m.author === "user";
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5",
                  mine ? "bg-primary text-primary-foreground" : "border bg-card",
                )}
              >
                <div
                  className={cn(
                    "mb-1 flex items-center justify-between gap-4 text-[10px]",
                    mine ? "text-primary-foreground/70" : "text-muted-foreground",
                  )}
                >
                  <span className="font-medium">{mine ? "You" : "Support"}</span>
                  <Time iso={m.at} />
                </div>
                {/* Bodies are sanitized on write (lib/sanitize) — safe to render. */}
                <div className={proseCls} dangerouslySetInnerHTML={{ __html: m.body }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Reply box, or a resolved note */}
      {resolved ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>This request is resolved. Need more help?</span>
          <Button variant="outline" onClick={() => openSupport({ source: "ticket" })}>
            <LifeBuoy className="size-4" aria-hidden /> Raise a new request
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <RichText value={reply} onChange={setReply} placeholder="Write a reply to support…" />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end">
            <Button onClick={send} disabled={busy || !richTextToPlain(reply).trim()}>
              {busy ? "Sending…" : "Send reply"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
