"use client";

// Admin Tickets inbox — stat cards + filterable table with multi-select bulk actions
// and a detail modal (message, reply thread, status, reply box). Every mutation goes
// through a Server Action, then router.refresh. Resolving a ticket emails the user the
// full conversation (handled server-side).

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LifeBuoy,
  Mail,
  Clock,
  Send,
  Search,
  CheckCircle2,
  CircleDot,
  Trash2,
  X,
  Check,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/admin/ui/card";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Badge } from "@/components/admin/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/admin/ui/dialog";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { RichText } from "@/components/admin/ui/rich-text";
import { richTextToPlain } from "@/lib/sanitize";
import {
  setTicketStatusAction,
  bulkSetTicketStatusAction,
  deleteTicketsAction,
  replyTicketAction,
} from "@/actions/admin-tickets";
import {
  TICKET_STATUS_LABELS,
  TICKET_CATEGORY_LABELS,
  type Ticket,
  type TicketCategory,
  type TicketStatus,
} from "@/lib/tickets-model";
import { cn } from "@/lib/utils";

const selectCls =
  "h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const checkboxCls = "size-4 shrink-0 cursor-pointer rounded border-input accent-primary";

const STATUS_BADGE: Record<TicketStatus, "warning" | "neutral" | "success"> = {
  open: "warning",
  in_progress: "neutral",
  resolved: "success",
};

const STATUS_FILTERS: ("all" | TicketStatus)[] = ["all", "open", "in_progress", "resolved"];

function fmt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
function catLabel(c: string): string {
  return TICKET_CATEGORY_LABELS[c as TicketCategory] ?? c;
}
function initials(name: string): string {
  return (name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

const proseCls =
  "text-sm [&_li]:ml-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5";

export function TicketsClient({ initial }: { initial: Ticket[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [fStatus, setFStatus] = useState<"all" | TicketStatus>("all");
  const [fCategory, setFCategory] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [flash, setFlash] = useState("");
  const [flashErr, setFlashErr] = useState(false);

  const counts = useMemo(
    () => ({
      total: initial.length,
      open: initial.filter((t) => t.status === "open").length,
      in_progress: initial.filter((t) => t.status === "in_progress").length,
      resolved: initial.filter((t) => t.status === "resolved").length,
    }),
    [initial],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initial.filter((t) => {
      if (fStatus !== "all" && t.status !== fStatus) return false;
      if (fCategory !== "all" && t.category !== fCategory) return false;
      if (q && ![t.subject, t.name, t.email].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [initial, query, fStatus, fCategory]);

  const active = activeId ? (initial.find((t) => t.id === activeId) ?? null) : null;

  // Keep selection to still-present rows.
  const presentIds = useMemo(() => new Set(initial.map((t) => t.id)), [initial]);
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => presentIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [presentIds]);

  const filteredIds = filtered.map((t) => t.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someSelected = filteredIds.some((id) => selected.has(id)) && !allSelected;
  const headerRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerRef.current) headerRef.current.indeterminate = someSelected;
  }, [someSelected]);

  function say(msg: string, err = false) {
    setFlash(msg);
    setFlashErr(err);
    setTimeout(() => setFlash((m) => (m === msg ? "" : m)), 2800);
  }
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) filteredIds.forEach((id) => next.delete(id));
      else filteredIds.forEach((id) => next.add(id));
      return next;
    });
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function changeStatus(id: string, status: TicketStatus) {
    const res = await setTicketStatusAction(id, status);
    if (res.ok) {
      say(status === "resolved" ? "Marked resolved — transcript emailed to the user." : `Marked ${TICKET_STATUS_LABELS[status].toLowerCase()}.`);
      router.refresh();
    } else say(res.error, true);
  }

  async function bulkStatus(status: TicketStatus) {
    const ids = [...selected];
    if (!ids.length) return;
    const res = await bulkSetTicketStatusAction(ids, status);
    if (res.ok) {
      say(status === "resolved" ? `Resolved ${ids.length} ticket(s) — users emailed.` : `Updated ${ids.length} ticket(s).`);
      setSelected(new Set());
      router.refresh();
    } else say(res.error, true);
  }

  async function bulkDelete() {
    const ids = [...selected];
    if (!ids.length) return;
    const res = await deleteTicketsAction(ids);
    if (res.ok) {
      say(`Deleted ${ids.length} ticket(s).`);
      setSelected(new Set());
      router.refresh();
    } else say(res.error, true);
  }

  async function sendReply(id: string) {
    if (!richTextToPlain(reply).trim()) return;
    setBusy(true);
    const res = await replyTicketAction(id, reply);
    setBusy(false);
    if (res.ok || res.error.startsWith("Reply saved")) {
      setReply("");
      say(res.ok ? "Reply sent." : res.error, !res.ok);
      router.refresh();
    } else say(res.error, true);
  }

  const selCount = selected.size;
  const statCards = [
    { label: "Total", value: counts.total, icon: LifeBuoy },
    { label: "Open", value: counts.open, icon: CircleDot },
    { label: "In progress", value: counts.in_progress, icon: Clock },
    { label: "Resolved", value: counts.resolved, icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-3 p-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search subject, name, email…" className="h-9 pl-8" />
        </div>
        <select className={selectCls} value={fStatus} onChange={(e) => setFStatus(e.target.value as "all" | TicketStatus)} aria-label="Filter status">
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>{s === "all" ? "All statuses" : TICKET_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select className={selectCls} value={fCategory} onChange={(e) => setFCategory(e.target.value)} aria-label="Filter category">
          <option value="all">All categories</option>
          {Object.entries(TICKET_CATEGORY_LABELS).map(([c, label]) => (
            <option key={c} value={c}>{label}</option>
          ))}
        </select>
        <span className="ml-auto text-sm text-muted-foreground">
          {filtered.length} of {initial.length}
        </span>
      </div>

      {flash && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
            flashErr ? "border-destructive/25 bg-destructive/10 text-destructive" : "border-status-applied-foreground/25 bg-status-applied text-status-applied-foreground",
          )}
        >
          {flashErr ? <AlertCircle className="size-4" aria-hidden /> : <Check className="size-4" aria-hidden />}
          {flash}
        </div>
      )}

      {/* Bulk action bar */}
      {selCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{selCount} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => bulkStatus("resolved")}>
              <CheckCircle2 className="size-4" /> Resolve
            </Button>
            <Button variant="outline" size="sm" onClick={() => bulkStatus("in_progress")}>
              <Clock className="size-4" /> In progress
            </Button>
            <Button variant="outline" size="sm" onClick={() => bulkStatus("open")}>
              <CircleDot className="size-4" /> Reopen
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="size-4" /> Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              <X className="size-4" /> Clear
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
          <LifeBuoy className="size-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm font-medium">No tickets</p>
          <p className="mt-1 text-xs text-muted-foreground">Support messages from users show up here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="w-10 px-3 py-2.5">
                  <input ref={headerRef} type="checkbox" className={checkboxCls} checked={allSelected} onChange={toggleAll} aria-label="Select all" />
                </th>
                <th className="px-4 py-2.5 font-medium">Subject</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">From</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Category</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => { setActiveId(t.id); setReply(""); }}
                  className={cn("cursor-pointer border-b border-border last:border-0 hover:bg-muted/40", selected.has(t.id) && "bg-primary/5")}
                >
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className={checkboxCls} checked={selected.has(t.id)} onChange={() => toggleOne(t.id)} aria-label={`Select ${t.subject}`} />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{t.subject}</p>
                    <p className="text-xs text-muted-foreground sm:hidden">{t.name || t.email}</p>
                    {t.replies.length > 0 && <span className="text-[11px] text-muted-foreground">{t.replies.length} repl{t.replies.length === 1 ? "y" : "ies"}</span>}
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <p className="truncate">{t.name || "Unknown"}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.email}</p>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">{catLabel(t.category)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_BADGE[t.status]}>{TICKET_STATUS_LABELS[t.status]}</Badge>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">{fmt(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      <Dialog open={active !== null} onOpenChange={(o) => !o && setActiveId(null)}>
        <DialogContent className="sm:max-w-xl">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 pr-6">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <LifeBuoy className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 truncate">{active.subject}</span>
                </DialogTitle>
              </DialogHeader>

              {/* Fixed-height body: meta/status/reply stay put, only the thread scrolls. */}
              <div className="flex h-[70vh] flex-col gap-4 px-0.5">
                {/* Requester + meta */}
                <div className="shrink-0 rounded-xl border bg-muted/20 p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {initials(active.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{active.name || "Unknown"}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Mail className="size-3.5 shrink-0" aria-hidden /> {active.email || "—"}
                      </p>
                    </div>
                    <Badge variant={STATUS_BADGE[active.status]}>{TICKET_STATUS_LABELS[active.status]}</Badge>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="rounded-full border bg-background px-2 py-0.5 font-medium text-foreground">{catLabel(active.category)}</span>
                    <span className="rounded-full border bg-background px-2 py-0.5">{active.source}</span>
                    <span className="flex items-center gap-1"><Clock className="size-3 shrink-0" aria-hidden /> {fmt(active.createdAt)}</span>
                  </div>
                </div>

                {/* Status control */}
                <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border p-3">
                  <span className="text-xs font-medium">Status</span>
                  <select className={selectCls} value={active.status} onChange={(e) => changeStatus(active.id, e.target.value as TicketStatus)}>
                    {(["open", "in_progress", "resolved"] as TicketStatus[]).map((s) => (
                      <option key={s} value={s}>{TICKET_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                  <span className="text-[11px] text-muted-foreground">Resolving emails the user the full conversation.</span>
                </div>

                {/* Conversation thread — the only scrolling region */}
                <div className="flex min-h-0 flex-1 flex-col">
                  <p className="mb-2 shrink-0 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Conversation</p>
                  <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto rounded-xl border bg-muted/10 p-2.5">
                    <div className="rounded-xl border bg-card p-3">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">{active.name || "User"}</span>
                        <span className="text-[10px] text-muted-foreground">{fmt(active.createdAt)}</span>
                      </div>
                      {/* Sanitized on write (lib/sanitize) — safe to render. */}
                      <div className={proseCls} dangerouslySetInnerHTML={{ __html: active.message }} />
                    </div>
                    {active.replies.map((r) => (
                      <div key={r.id} className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-primary">Support</span>
                          <span className="text-[10px] text-muted-foreground">{fmt(r.createdAt)}</span>
                        </div>
                        <div className={proseCls} dangerouslySetInnerHTML={{ __html: r.body }} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reply composer */}
                <div className="shrink-0 space-y-2">
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Reply</p>
                  <RichText value={reply} onChange={setReply} placeholder="Write a reply — it's emailed to the user…" />
                  <div className="flex items-center justify-end">
                    <Button onClick={() => sendReply(active.id)} disabled={busy || !richTextToPlain(reply).trim()}>
                      <Send /> {busy ? "Sending…" : "Send reply"}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selCount} ticket${selCount === 1 ? "" : "s"}?`}
        description="This permanently removes the selected tickets and their replies. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={bulkDelete}
      />
    </div>
  );
}
