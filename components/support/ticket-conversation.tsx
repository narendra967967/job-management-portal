"use client";

// User-side ticket conversation — a live messenger-style chat for one of the user's
// own tickets. Messages group by sender with avatars, day dividers, in-bubble times,
// and delivery/read ticks. New messages arrive live over SSE; the composer is pinned
// at the bottom. Replies are disabled once the ticket is resolved. Reusable on the
// full /support/[id] page and inside the floating help widget (pass onBack/embedded).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CheckCheck, LifeBuoy, Send } from "lucide-react";
import { RichText } from "@/components/ui/rich-text";
import { Button } from "@/components/ui/button";
import { useContactSupport } from "@/components/support/contact-support";
import { TicketStatusPill } from "@/components/support/ticket-status-pill";
import { useSupportStream } from "@/lib/use-support-stream";
import { richTextToPlain } from "@/lib/sanitize";
import {
  markMyTicketDeliveredAction,
  markMyTicketReadAction,
  replyToMyTicketAction,
} from "@/actions/support";
import {
  TICKET_CATEGORY_LABELS,
  messageTick,
  ticketRef,
  type Ticket,
  type TicketAuthor,
  type TicketCategory,
  type TicketReceipts,
  type TicketReply,
  type TicketStatus,
  type TickState,
} from "@/lib/tickets-model";
import { cn } from "@/lib/utils";

const proseCls =
  "text-sm leading-relaxed [&_li]:ml-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5";

const day = (iso: string) => iso.slice(0, 10);

function ClientTime({ iso, mode, className }: { iso: string; mode: "time" | "day"; className?: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    const d = new Date(iso);
    if (mode === "time") {
      setText(d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }));
      return;
    }
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) setText("Today");
    else if (d.toDateString() === yesterday.toDateString()) setText("Yesterday");
    else setText(d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }));
  }, [iso, mode]);
  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}

/** Delivery/read ticks for the user's own (outgoing) messages. */
function Ticks({ state }: { state: TickState }) {
  if (state === "sent") return <Check className="inline size-3" aria-label="Sent" />;
  return (
    <CheckCheck
      className={cn("inline size-3", state === "read" ? "text-sky-300" : "")}
      aria-label={state === "read" ? "Read" : "Delivered"}
    />
  );
}

type Msg = { id: string; author: TicketAuthor; body: string; at: string };

const replyToMsg = (r: TicketReply): Msg => ({ id: r.id, author: r.author, body: r.body, at: r.createdAt });

function buildMessages(t: Ticket): Msg[] {
  return [{ id: "message", author: "user", body: t.message, at: t.createdAt }, ...t.replies.map(replyToMsg)];
}
function pickReceipts(t: Ticket): TicketReceipts {
  return {
    lastReadByUserAt: t.lastReadByUserAt,
    lastReadByAdminAt: t.lastReadByAdminAt,
    lastDeliveredToUserAt: t.lastDeliveredToUserAt,
    lastDeliveredToAdminAt: t.lastDeliveredToAdminAt,
  };
}

export function TicketConversation({
  ticket,
  embedded = false,
  onRaiseNew,
}: {
  ticket: Ticket;
  /** Fills the parent and drops the page chrome (back link) — the widget provides its own. */
  embedded?: boolean;
  /** Overrides the resolved-ticket "raise a new request" action (widget uses its own flow). */
  onRaiseNew?: () => void;
}) {
  const { open: openSupport } = useContactSupport();
  const [messages, setMessages] = useState<Msg[]>(() => buildMessages(ticket));
  const [receipts, setReceipts] = useState<TicketReceipts>(() => pickReceipts(ticket));
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const resolved = status === "resolved";

  // Re-seed when the ticket changes (navigation / selecting another in the widget).
  useEffect(() => {
    setMessages(buildMessages(ticket));
    setReceipts(pickReceipts(ticket));
    setStatus(ticket.status);
    setReply("");
    setError("");
  }, [ticket]);

  // Opening the ticket marks support's messages read.
  useEffect(() => {
    void markMyTicketReadAction(ticket.id);
  }, [ticket.id]);

  // Live updates for this ticket.
  useSupportStream("/api/support/stream", (e) => {
    if (e.ticketId !== ticket.id) return;
    if (e.type === "reply") {
      const r = replyToMsg(e.reply as TicketReply);
      setMessages((prev) => (prev.some((m) => m.id === r.id) ? prev : [...prev, r]));
      if (typeof e.status === "string") setStatus(e.status as TicketStatus);
      if (r.author === "admin") {
        // Window is open → the admin's message is delivered and read.
        void markMyTicketDeliveredAction(ticket.id);
        void markMyTicketReadAction(ticket.id);
      }
    } else if (e.type === "receipt" && e.party === "admin") {
      const at = String(e.at);
      setReceipts((prev) => ({
        ...prev,
        lastDeliveredToAdminAt: at,
        ...(e.kind === "read" ? { lastReadByAdminAt: at } : {}),
      }));
    } else if (e.type === "status") {
      setStatus(e.status as TicketStatus);
    }
  });

  // Keep the latest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
  }, [messages.length]);

  async function send() {
    if (!richTextToPlain(reply).trim() || busy) return;
    setBusy(true);
    setError("");
    const res = await replyToMyTicketAction({ ticketId: ticket.id, body: reply });
    setBusy(false);
    if (res.ok) {
      const r = replyToMsg(res.reply);
      setMessages((prev) => (prev.some((m) => m.id === r.id) ? prev : [...prev, r]));
      setReply("");
    } else {
      setError(res.error);
    }
  }

  const category = TICKET_CATEGORY_LABELS[ticket.category as TicketCategory] ?? ticket.category;

  return (
    <div className={embedded ? "flex h-full min-h-0 flex-col" : "mx-auto flex h-full max-w-2xl flex-col gap-3"}>
      {!embedded && (
        <Link
          href="/settings?tab=help"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Help &amp; support
        </Link>
      )}

      {/* Chat window */}
      <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden border bg-card", embedded ? "" : "rounded-2xl shadow-xs")}>
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <LifeBuoy className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{ticket.subject}</p>
            <p className="truncate text-xs text-muted-foreground">
              <span className="font-mono">{ticketRef(ticket.number)}</span> · {category}
            </p>
          </div>
          <TicketStatusPill status={status} />
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-0 overflow-y-auto bg-muted/20 px-3 py-4 sm:px-4">
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const newDay = !prev || day(prev.at) !== day(m.at);
            const firstOfGroup = newDay || !prev || prev.author !== m.author;
            const lastOfGroup = !next || next.author !== m.author || day(next.at) !== day(m.at);
            const mine = m.author === "user";
            return (
              <div key={m.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out">
                {newDay && (
                  <div className="my-3 flex justify-center">
                    <ClientTime
                      iso={m.at}
                      mode="day"
                      className="rounded-full bg-background/70 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border"
                    />
                  </div>
                )}
                <div
                  className={cn(
                    "flex items-end gap-2",
                    mine ? "justify-end" : "justify-start",
                    !newDay && (firstOfGroup ? "mt-3" : "mt-1"),
                  )}
                >
                  {!mine && (
                    <div className="w-7 shrink-0 self-end">
                      {lastOfGroup && (
                        <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <LifeBuoy className="size-3.5" aria-hidden />
                        </span>
                      )}
                    </div>
                  )}
                  <div className={cn("flex max-w-[82%] flex-col sm:max-w-[75%]", mine ? "items-end" : "items-start")}>
                    {firstOfGroup && !mine && (
                      <span className="mb-1 ml-1 text-[11px] font-medium text-muted-foreground">Support</span>
                    )}
                    <div
                      className={cn(
                        "px-3 py-2",
                        mine ? "rounded-2xl bg-primary text-primary-foreground" : "rounded-2xl border bg-card",
                        mine ? (lastOfGroup ? "rounded-br-md" : "") : lastOfGroup ? "rounded-bl-md" : "",
                        !firstOfGroup && (mine ? "rounded-tr-md" : "rounded-tl-md"),
                      )}
                    >
                      {/* Bodies are sanitized on write (lib/sanitize) — safe to render. */}
                      <div className={proseCls} dangerouslySetInnerHTML={{ __html: m.body }} />
                      <span
                        className={cn(
                          "mt-0.5 flex items-center justify-end gap-1 text-[10px]",
                          mine ? "text-primary-foreground/70" : "text-muted-foreground",
                        )}
                      >
                        <ClientTime iso={m.at} mode="time" />
                        {mine && <Ticks state={messageTick("user", m.at, receipts)} />}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Composer, or the resolved note */}
        <div className="shrink-0 border-t bg-card p-2.5">
          {resolved ? (
            <div className="flex flex-col items-start gap-2 rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>This request is resolved. Need more help?</span>
              <Button variant="outline" size="sm" onClick={() => (onRaiseNew ? onRaiseNew() : openSupport({ source: "ticket" }))}>
                <LifeBuoy className="size-4" aria-hidden /> Raise a new request
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <RichText value={reply} onChange={setReply} placeholder="Write a reply to support…" />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex justify-end">
                <Button onClick={send} disabled={busy || !richTextToPlain(reply).trim()}>
                  <Send className="size-4" aria-hidden /> {busy ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
