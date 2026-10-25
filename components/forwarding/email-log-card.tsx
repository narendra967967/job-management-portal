"use client";

// Settings → Email log: every email that reached the user's own forwarding
// address — accepted, rejected and why — so they can see what arrived without
// asking support. Metadata only (the log never stores email content).

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { useMounted } from "@/lib/use-mounted";
import { listMyEmailLogAction } from "@/actions/email-intake";
import {
  INBOUND_STATUS_LABELS,
  type InboundStatus,
  type MyEmailLogRow,
} from "@/lib/email-intake-model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAGE_SIZE = 25;

const STATUS_TONE: Record<InboundStatus, string> = {
  accepted: "bg-status-applied text-status-applied-foreground",
  rejected: "bg-destructive/10 text-destructive",
  unsupported: "bg-status-shortlisted text-status-shortlisted-foreground",
  duplicate: "bg-muted text-muted-foreground",
  gmail_code: "bg-status-new text-status-new-foreground",
  queued: "bg-ai-muted text-ai",
};

/** Status names as users see them (admin wording is a bit more technical). */
const STATUS_TEXT: Record<InboundStatus, string> = {
  ...INBOUND_STATUS_LABELS,
  accepted: "Accepted",
  unsupported: "No jobs found",
  duplicate: "Already received",
};

const STATUS_ITEMS: Record<string, string> = {
  all: "All statuses",
  ...STATUS_TEXT,
};

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function EmailLogCard() {
  const mounted = useMounted();
  const [from, setFrom] = useState(() => ymd(new Date(Date.now() - 6 * 24 * 60 * 60_000)));
  const [to, setTo] = useState(() => ymd(new Date()));
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<MyEmailLogRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    const res = await listMyEmailLogAction({
      from,
      to,
      tzo: new Date().getTimezoneOffset(),
      status,
      page,
      size: PAGE_SIZE,
    }).catch(() => null);
    setBusy(false);
    if (!res) return setError("Couldn't load the log. Try again.");
    if (!res.ok) return setError(res.error);
    setRows(res.rows);
    setTotal(res.total);
    setRetentionDays(res.retentionDays);
  }, [from, to, status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(total, page * PAGE_SIZE);
  const filter = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Email log</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Emails that reached your forwarding address, and what happened to each.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => void load()} disabled={busy} aria-label="Refresh" className="shrink-0 bg-white/50">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-[1fr_1fr_1.3fr]">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">From</span>
          <Input type="date" value={from} max={to} onChange={(e) => e.target.value && filter(() => setFrom(e.target.value))} className="h-11 bg-white/50 sm:h-9" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">To</span>
          <Input type="date" value={to} min={from} onChange={(e) => e.target.value && filter(() => setTo(e.target.value))} className="h-11 bg-white/50 sm:h-9" />
        </label>
        <div className="col-span-2 space-y-1 xl:col-span-1">
          <span className="text-xs font-medium text-muted-foreground">Status</span>
          <Select items={STATUS_ITEMS} value={status} onValueChange={(v) => filter(() => setStatus(String(v ?? "all")))}>
            <SelectTrigger aria-label="Status" className="h-11 w-full bg-white/50 sm:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_ITEMS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className={cn("mt-4 transition-opacity", busy && rows && "opacity-60")}>
        {rows === null ? (
          <div className="h-32 animate-pulse rounded-xl bg-muted/40" aria-busy />
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No emails in these dates.
          </p>
        ) : (
          <>
            {/* Phones to laptops (the settings column is narrow): stacked rows */}
            <ul className="divide-y rounded-xl border xl:hidden">
              {rows.map((r) => (
                <li key={r.id} className="space-y-1 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{mounted ? formatDateTime(r.receivedAt) : " "}</span>
                    <StatusPill status={r.status} />
                  </div>
                  <p className="truncate text-sm">
                    <span className="font-medium">{r.site}</span>
                    <span className="text-muted-foreground"> · {r.sender}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{r.reason}</p>
                  {r.leadsCreated > 0 && (
                    <p className="text-xs font-medium text-status-applied-foreground">
                      {r.leadsCreated} new {r.leadsCreated === 1 ? "lead" : "leads"}
                    </p>
                  )}
                </li>
              ))}
            </ul>

            {/* Wide screens: table */}
            <div className="hidden overflow-x-auto rounded-xl border xl:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-white/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Received</th>
                    <th className="px-3 py-2 font-medium">Site</th>
                    <th className="px-3 py-2 font-medium">Sender</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Details</th>
                    <th className="px-3 py-2 text-right font-medium">New leads</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">
                        {mounted ? formatDateTime(r.receivedAt) : " "}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.site}</td>
                      <td className="max-w-40 truncate px-3 py-2 text-xs text-muted-foreground" title={r.sender}>
                        {r.sender}
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill status={r.status} />
                      </td>
                      <td className="min-w-56 px-3 py-2 text-xs text-muted-foreground">{r.reason}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.leadsCreated || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {total > 0 ? `Showing ${first}–${last} of ${total}` : ""}
          {retentionDays != null && (
            <span>
              {total > 0 ? " · " : ""}Kept {retentionDays} days · email content is never stored
            </span>
          )}
        </span>
        {pages > 1 && (
          <span className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="bg-white/50" onClick={() => setPage((p) => p - 1)} disabled={page <= 1 || busy}>
              <ChevronLeft className="size-3.5" aria-hidden />
              Prev
            </Button>
            <span className="px-1 tabular-nums">
              {page} / {pages}
            </span>
            <Button variant="outline" size="sm" className="bg-white/50" onClick={() => setPage((p) => p + 1)} disabled={page >= pages || busy}>
              Next
              <ChevronRight className="size-3.5" aria-hidden />
            </Button>
          </span>
        )}
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: InboundStatus }) {
  return (
    <span className={cn("inline-flex shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap", STATUS_TONE[status])}>
      {STATUS_TEXT[status]}
    </span>
  );
}
