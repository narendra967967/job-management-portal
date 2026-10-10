"use client";

// Floating help widget (user side) — a bottom-right launcher that opens a support
// panel (a card on desktop, full-screen on mobile) without leaving the page. The
// panel has three views: the user's ticket list (with per-ticket unread counts), a
// live conversation (reusing TicketConversation), and a "new request" form. The
// launcher carries a live unread badge for admin replies the user hasn't read.
// Settings → Help & support is unchanged; this is an additional entry point.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  LifeBuoy,
  MessageCircle,
  Plus,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichText } from "@/components/ui/rich-text";
import { toast } from "@/components/ui/toast";
import { TicketConversation } from "@/components/support/ticket-conversation";
import { TicketStatusPill } from "@/components/support/ticket-status-pill";
import { useSupportStream } from "@/lib/use-support-stream";
import { richTextToPlain } from "@/lib/sanitize";
import {
  getMyTicketAction,
  listMyTicketsAction,
  myUnreadCountAction,
  submitSupportTicketAction,
} from "@/actions/support";
import {
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABELS,
  ticketRef,
  type Ticket,
  type TicketCategory,
  type UserTicketSummary,
} from "@/lib/tickets-model";
import { cn } from "@/lib/utils";

type View = "list" | "conversation" | "new";

const selectCls =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function RelativeTime({ iso }: { iso: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.round(diff / 60000);
    if (mins < 1) setText("just now");
    else if (mins < 60) setText(`${mins}m ago`);
    else if (mins < 1440) setText(`${Math.round(mins / 60)}h ago`);
    else if (d.toDateString() === now.toDateString()) setText("today");
    else setText(d.toLocaleDateString(undefined, { day: "numeric", month: "short" }));
  }, [iso]);
  return (
    <span suppressHydrationWarning>{text}</span>
  );
}

export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("list");
  const [tickets, setTickets] = useState<UserTicketSummary[] | null>(null);
  const [active, setActive] = useState<Ticket | null>(null);
  const [loadingConvo, setLoadingConvo] = useState(false);
  const [unread, setUnread] = useState(0);

  // "New request" form.
  const [category, setCategory] = useState<TicketCategory>("question");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Latest view/open for the SSE handler (avoids re-subscribing on each change).
  const stateRef = useRef({ open, view });
  stateRef.current = { open, view };

  const refreshUnread = useCallback(() => {
    void myUnreadCountAction().then(setUnread);
  }, []);

  const loadList = useCallback(async () => {
    const res = await listMyTicketsAction();
    if (res.ok) setTickets(res.tickets);
  }, []);

  // Seed the badge on mount and keep it live even while the panel is closed.
  useEffect(() => {
    refreshUnread();
  }, [refreshUnread]);

  useSupportStream("/api/support/stream", (e) => {
    const { open: isOpen, view: v } = stateRef.current;
    const refetchList = isOpen && v === "list";
    if (e.type === "reply") {
      // An admin reply the user hasn't opened bumps the unread badge + list counts.
      if ((e.reply as { author?: string } | undefined)?.author === "admin") refreshUnread();
      if (refetchList) void loadList();
    } else if (e.type === "receipt" && e.party === "user") {
      // The user read a thread elsewhere (or in the embedded chat) — resync.
      refreshUnread();
      if (refetchList) void loadList();
    } else if (e.type === "status" || e.type === "ticket") {
      if (refetchList) void loadList();
    }
  });

  function openPanel() {
    setOpen(true);
    setView("list");
    setActive(null);
    void loadList();
    refreshUnread();
  }

  function closePanel() {
    setOpen(false);
  }

  async function openConversation(id: string) {
    setLoadingConvo(true);
    setView("conversation");
    const res = await getMyTicketAction(id);
    setLoadingConvo(false);
    if (res.ok) {
      setActive(res.ticket);
    } else {
      toast.error("Couldn't open request", res.error);
      setView("list");
    }
  }

  function backToList() {
    setActive(null);
    setView("list");
    void loadList();
    refreshUnread();
  }

  function startNew() {
    setCategory("question");
    setSubject("");
    setMessage("");
    setView("new");
  }

  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    if (subject.trim().length < 3) return toast.error("Add a short subject");
    if (richTextToPlain(message).length < 5) return toast.error("Tell us a bit more about the issue");
    setSending(true);
    const res = await submitSupportTicketAction({
      category,
      subject: subject.trim(),
      message,
      source: "widget",
    });
    setSending(false);
    if (res.ok) {
      toast.success("Request sent", "We'll reply right here and to your email.");
      await loadList();
      setView("list");
    } else {
      toast.error("Couldn't send", res.error);
    }
  }

  const badge = unread > 0 ? (unread > 9 ? "9+" : String(unread)) : null;

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => (open ? closePanel() : openPanel())}
        aria-label={open ? "Close help" : "Help & support"}
        aria-expanded={open}
        className={cn(
          "fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:right-6 sm:bottom-6",
          open && "scale-95",
        )}
      >
        {open ? <ChevronDown className="size-6" aria-hidden /> : <MessageCircle className="size-6" aria-hidden />}
        {!open && badge && (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold text-white ring-2 ring-background">
            {badge}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Help & support"
          className="fixed inset-0 z-50 flex flex-col overflow-hidden border-0 bg-card sm:inset-auto sm:right-6 sm:bottom-24 sm:h-[600px] sm:max-h-[calc(100dvh-7rem)] sm:w-[380px] sm:rounded-2xl sm:border sm:shadow-2xl"
        >
          {/* Panel header */}
          <div className="flex shrink-0 items-center gap-2 border-b bg-primary px-4 py-3 text-primary-foreground">
            {view === "list" ? (
              <>
                <LifeBuoy className="size-5 shrink-0" aria-hidden />
                <p className="flex-1 text-sm font-semibold">Help &amp; support</p>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={backToList}
                  className="-ml-1 flex items-center gap-1 rounded-md px-1.5 py-1 text-sm font-medium hover:bg-white/15"
                >
                  <ChevronDown className="size-4 rotate-90" aria-hidden />
                  All requests
                </button>
                <span className="flex-1" />
              </>
            )}
            <button
              type="button"
              onClick={closePanel}
              aria-label="Close"
              className="flex size-8 items-center justify-center rounded-md hover:bg-white/15"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          {/* Panel body */}
          <div className="min-h-0 flex-1 overflow-hidden">
            {view === "list" && (
              <div className="flex h-full flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  {tickets === null ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
                  ) : tickets.length === 0 ? (
                    <div className="flex flex-col items-center px-6 py-10 text-center">
                      <LifeBuoy className="size-6 text-muted-foreground" aria-hidden />
                      <p className="mt-3 text-sm font-medium">No requests yet</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Start a request and we&apos;ll reply right here.
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-1.5">
                      {tickets.map((t) => (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => openConversation(t.id)}
                            className="flex w-full flex-col gap-1 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-2">
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.subject}</span>
                              {t.unreadCount > 0 && (
                                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive text-[11px] font-semibold text-white">
                                  {t.unreadCount > 9 ? "9+" : t.unreadCount}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="font-mono">{ticketRef(t.number)}</span>
                              <TicketStatusPill status={t.status} />
                              <span className="ml-auto">
                                <RelativeTime iso={t.updatedAt} />
                              </span>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="shrink-0 border-t p-3">
                  <Button className="w-full gap-2" onClick={startNew}>
                    <Plus className="size-4" aria-hidden /> New request
                  </Button>
                </div>
              </div>
            )}

            {view === "conversation" && (
              <div className="h-full">
                {loadingConvo || !active ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
                ) : (
                  <TicketConversation ticket={active} embedded onRaiseNew={startNew} />
                )}
              </div>
            )}

            {view === "new" && (
              <form onSubmit={submitNew} className="flex h-full flex-col">
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Category</span>
                    <select className={selectCls} value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)}>
                      {TICKET_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{TICKET_CATEGORY_LABELS[c]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Subject</span>
                    <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Briefly, what's this about?" maxLength={120} />
                  </label>
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Message</span>
                    <RichText value={message} onChange={setMessage} placeholder="Share the details — what happened, what you expected…" />
                  </div>
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2 border-t p-3">
                  <Button type="button" variant="outline" onClick={() => setView("list")} disabled={sending}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={sending}>
                    <Send className="size-4" aria-hidden /> {sending ? "Sending…" : "Send"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
