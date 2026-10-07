"use client";

// Admin Tickets inbox — list + detail dialog (full message, reply thread, reply box,
// status control). Every mutation goes through a Server Action, then router.refresh.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LifeBuoy, Mail, Clock, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Button } from "@/components/admin/ui/button";
import { setTicketStatusAction, replyTicketAction } from "@/actions/admin-tickets";
import { TICKET_STATUS_LABELS, TICKET_CATEGORY_LABELS, type Ticket, type TicketCategory, type TicketStatus } from "@/lib/tickets-model";
import { cn } from "@/lib/utils";

const STATUS_FILTERS: ("all" | TicketStatus)[] = ["all", "open", "in_progress", "resolved"];

const STATUS_STYLE: Record<TicketStatus, string> = {
  open: "bg-status-reviewing text-status-reviewing-foreground",
  in_progress: "bg-status-new text-status-new-foreground",
  resolved: "bg-status-applied text-status-applied-foreground",
};

const selectCls =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const textareaCls =
  "min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function fmt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function TicketsClient({ initial }: { initial: Ticket[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | TicketStatus>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [flashErr, setFlashErr] = useState(false);

  const tickets = filter === "all" ? initial : initial.filter((t) => t.status === filter);
  const active = activeId ? (initial.find((t) => t.id === activeId) ?? null) : null;
  const openCount = initial.filter((t) => t.status === "open").length;

  function say(msg: string, err = false) {
    setFlash(msg);
    setFlashErr(err);
    setTimeout(() => setFlash((m) => (m === msg ? "" : m)), 2800);
  }

  async function changeStatus(id: string, status: TicketStatus) {
    const res = await setTicketStatusAction(id, status);
    if (res.ok) {
      say(`Marked ${TICKET_STATUS_LABELS[status].toLowerCase()}.`);
      router.refresh();
    } else say(res.error, true);
  }

  async function sendReply(id: string) {
    if (!reply.trim()) return;
    setBusy(true);
    const res = await replyTicketAction(id, reply);
    setBusy(false);
    if (res.ok) {
      setReply("");
      say("Reply sent.");
      router.refresh();
    } else {
      say(res.error, true);
      if (res.error.startsWith("Reply saved")) {
        setReply("");
        router.refresh();
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                filter === s ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted",
              )}
            >
              {s === "all" ? "All" : TICKET_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        {flash ? (
          <span className={cn("text-sm", flashErr ? "text-destructive" : "text-status-applied-foreground")}>{flash}</span>
        ) : (
          <span className="text-sm text-muted-foreground">
            {openCount} open · {initial.length} total
          </span>
        )}
      </div>

      {tickets.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
          <LifeBuoy className="size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm font-medium">No tickets</p>
          <p className="mt-1 text-xs text-muted-foreground">Support messages from users show up here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setActiveId(t.id); setReply(""); }}
              className="flex w-full items-start gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/50"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <LifeBuoy className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{t.subject}</span>
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", STATUS_STYLE[t.status])}>
                    {TICKET_STATUS_LABELS[t.status]}
                  </span>
                  {t.replies.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">{t.replies.length} repl{t.replies.length === 1 ? "y" : "ies"}</span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {t.name || t.email || "Unknown"} · {TICKET_CATEGORY_LABELS[t.category as TicketCategory] ?? t.category} · {t.source} · {fmt(t.createdAt)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      <Dialog open={active !== null} onOpenChange={(o) => !o && setActiveId(null)}>
        <DialogContent className="sm:max-w-lg">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-6">{active.subject}</DialogTitle>
              </DialogHeader>
              <div className="max-h-[70vh] space-y-4 overflow-y-auto">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Mail className="size-3.5" aria-hidden /> {active.email || "—"}</span>
                  <span>{active.name || "Unknown"}</span>
                  <span>· {TICKET_CATEGORY_LABELS[active.category as TicketCategory] ?? active.category}</span>
                  <span>· {active.source}</span>
                  <span className="flex items-center gap-1"><Clock className="size-3.5" aria-hidden /> {fmt(active.createdAt)}</span>
                </div>

                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Status
                  <select
                    className={selectCls}
                    value={active.status}
                    onChange={(e) => changeStatus(active.id, e.target.value as TicketStatus)}
                  >
                    {(["open", "in_progress", "resolved"] as TicketStatus[]).map((s) => (
                      <option key={s} value={s}>{TICKET_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </label>

                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-sm whitespace-pre-wrap">{active.message}</p>
                </div>

                {active.replies.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Replies</p>
                    {active.replies.map((r) => (
                      <div key={r.id} className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                        <p className="text-sm whitespace-pre-wrap">{r.body}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">Sent {fmt(r.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Reply</p>
                  <textarea
                    className={textareaCls}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Write a reply — it's emailed to the user…"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button onClick={() => sendReply(active.id)} disabled={busy || !reply.trim()}>
                      <Send /> {busy ? "Sending…" : "Send reply"}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
