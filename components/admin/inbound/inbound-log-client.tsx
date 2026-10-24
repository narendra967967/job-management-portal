"use client";

// Inbound email log (A5). Filters — date range (default today, in the viewer's
// timezone), user email, status, free text — are applied with Fetch and live
// in the URL; the server page filters and paginates in the database. Shows
// metadata only: rejected mail keeps just the sender's domain.

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/admin/ui/input";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card } from "@/components/admin/ui/card";
import {
  INBOUND_LOG_PAGE_SIZES,
  INBOUND_STATUS_LABELS,
  formatBytes,
  siteLabel,
  type InboundLogEntry,
  type InboundStatus,
} from "@/lib/email-intake-model";
import { useMounted } from "@/lib/use-mounted";
import { formatDateTime } from "@/lib/utils";

const STATUS_VARIANT: Record<InboundStatus, "success" | "danger" | "warning" | "neutral"> = {
  accepted: "success",
  rejected: "danger",
  unsupported: "warning",
  duplicate: "neutral",
  gmail_code: "neutral",
  queued: "neutral",
};

const selectCls =
  "h-11 sm:h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const labelCls = "flex min-w-0 flex-col gap-1 text-[11px] font-medium text-muted-foreground";

export interface InboundLogFilters {
  from: string;
  to: string;
  /** Browser's getTimezoneOffset() — dates are days in the viewer's timezone. */
  tzo: number;
  user: string;
  status: InboundStatus | "all";
  q: string;
  page: number;
  size: number;
}

/** Today as YYYY-MM-DD in the browser's timezone. */
function localToday(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function InboundLogClient({
  filters,
  rows,
  total,
  retentionDays,
  needsDates = false,
}: {
  filters: InboundLogFilters;
  rows: InboundLogEntry[];
  total: number;
  retentionDays: number;
  needsDates?: boolean;
}) {
  const mounted = useMounted(); // times render in the viewer's timezone
  const router = useRouter();
  const pathname = usePathname();

  // Draft filters; applied with Fetch.
  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);
  const [user, setUser] = useState(filters.user);
  const [status, setStatus] = useState(filters.status);
  const [q, setQ] = useState(filters.q);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function go(next: Partial<InboundLogFilters>) {
    const f = { ...filters, tzo: new Date().getTimezoneOffset(), ...next };
    const params = new URLSearchParams();
    params.set("from", f.from);
    params.set("to", f.to);
    params.set("tzo", String(f.tzo));
    if (f.user.trim()) params.set("user", f.user.trim());
    if (f.status !== "all") params.set("status", f.status);
    if (f.q.trim()) params.set("q", f.q.trim());
    if (f.page > 1) params.set("page", String(f.page));
    if (f.size !== 50) params.set("size", String(f.size));
    setLoading(true);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // New results arrived — stop the spinner and sync the drafts.
  useEffect(() => {
    setLoading(false);
    setFrom(filters.from);
    setTo(filters.to);
  }, [filters.from, filters.to, filters.page, filters.size, filters.user, filters.status, filters.q, rows]);

  // First visit: today's log.
  useEffect(() => {
    if (!needsDates) return;
    const today = localToday();
    go({ from: today, to: today, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsDates]);

  function fetchLog(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to) return setError("Choose both dates.");
    if (from > to) return setError("“From” must be on or before “To”.");
    setError("");
    go({ from, to, user, status, q, page: 1 });
  }

  const pageCount = Math.max(1, Math.ceil(total / filters.size));
  const first = total ? (filters.page - 1) * filters.size + 1 : 0;
  const last = Math.min(filters.page * filters.size, total);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <form onSubmit={fetchLog} className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
        <label className={labelCls}>
          From
          <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="h-11 sm:h-9" required />
        </label>
        <label className={labelCls}>
          To
          <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="h-11 sm:h-9" required />
        </label>
        <label className={`${labelCls} col-span-2 sm:w-56`}>
          User email
          <Input type="search" value={user} onChange={(e) => setUser(e.target.value)} placeholder="Part of an email" maxLength={254} className="h-11 sm:h-9" />
        </label>
        <label className={labelCls}>
          Status
          <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as InboundStatus | "all")}>
            <option value="all">All statuses</option>
            {(Object.keys(INBOUND_STATUS_LABELS) as InboundStatus[]).map((s) => (
              <option key={s} value={s}>
                {INBOUND_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Search
          <span className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sender, site or reason" maxLength={100} className="h-11 sm:h-9 pl-8 sm:w-48" />
          </span>
        </label>
        <Button type="submit" className="col-span-2 min-h-11 sm:col-span-1 sm:min-h-9" disabled={loading}>
          {loading ? "Fetching…" : "Fetch"}
        </Button>
        {error && <p className="col-span-2 text-xs text-destructive sm:basis-full">{error}</p>}
      </form>

      {/* Wide screens: table; below xl (next to the admin sidebar): stacked rows */}
      <Card className="hidden overflow-x-auto p-0 xl:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Received</th>
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">Site</th>
              <th className="px-4 py-2.5 font-medium">Sender</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Detail</th>
              <th className="px-4 py-2.5 text-right font-medium">Size</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                  {mounted ? formatDateTime(r.receivedAt) : ""}
                </td>
                <td className="px-4 py-2.5">
                  {r.user ? (
                    <span className="block min-w-0">
                      <span className="block truncate">{r.user.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{r.user.email}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Unknown address</span>
                  )}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">{siteLabel(r.site)}</td>
                <td className="px-4 py-2.5 font-mono text-[12px]">
                  <SenderText row={r} />
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant={STATUS_VARIANT[r.status]}>{INBOUND_STATUS_LABELS[r.status]}</Badge>
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.reason}</td>
                <td className="px-4 py-2.5 text-right text-xs tabular-nums text-muted-foreground">{formatBytes(r.sizeBytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <ul className="space-y-2 xl:hidden">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl border bg-card p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <Badge variant={STATUS_VARIANT[r.status]}>{INBOUND_STATUS_LABELS[r.status]}</Badge>
              <span className="text-[11px] text-muted-foreground">{mounted ? formatDateTime(r.receivedAt) : ""}</span>
            </div>
            <p className="mt-1.5 truncate">
              {r.user ? r.user.name : <span className="text-muted-foreground">Unknown address</span>}
              <span className="text-muted-foreground"> · {siteLabel(r.site)}</span>
            </p>
            <p className="truncate font-mono text-[12px] text-muted-foreground">
              <SenderText row={r} />
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {r.reason} · {formatBytes(r.sizeBytes)}
            </p>
          </li>
        ))}
      </ul>

      {rows.length === 0 && !needsDates && (
        <p className="py-10 text-center text-sm text-muted-foreground">No emails match these filters.</p>
      )}

      {total > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            Showing {first}–{last} of {total}
          </span>
          <label className="flex items-center gap-1.5 text-muted-foreground">
            Rows
            <select
              className={selectCls + " sm:h-8"}
              value={filters.size}
              onChange={(e) => go({ size: Number(e.target.value), page: 1 })}
            >
              {INBOUND_LOG_PAGE_SIZES.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" className="min-h-11 sm:min-h-8" disabled={filters.page <= 1 || loading} onClick={() => go({ page: filters.page - 1 })}>
              <ChevronLeft className="size-4" /> Prev
            </Button>
            <span className="text-muted-foreground">
              Page {filters.page} of {pageCount}
            </span>
            <Button variant="outline" size="sm" className="min-h-11 sm:min-h-8" disabled={filters.page >= pageCount || loading} onClick={() => go({ page: filters.page + 1 })}>
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Kept {retentionDays} {retentionDays === 1 ? "day" : "days"} · no email content is stored
      </p>
    </div>
  );
}

/** Full address for accepted job-site mail; the domain only for everything else. */
function SenderText({ row }: { row: InboundLogEntry }) {
  return <>{row.fromAddress ?? `…@${row.fromDomain}`}</>;
}
