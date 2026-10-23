"use client";

// Inbound email log (A5): filter by status and free text (user, sender,
// reason). Shows metadata only — rejected mail keeps just the sender's domain.
// Rows are purged after 30 days. The server page does the filtering; this
// keeps the filters in the URL.

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/admin/ui/input";
import { Badge } from "@/components/admin/ui/badge";
import { Card } from "@/components/admin/ui/card";
import {
  INBOUND_STATUS_LABELS,
  formatBytes,
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
};

const selectCls =
  "h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function InboundLogClient({
  rows,
  status,
  q: initialQ,
  pageSize,
}: {
  rows: InboundLogEntry[];
  status: InboundStatus | "all";
  q: string;
  pageSize: number;
}) {
  const mounted = useMounted(); // times render in the viewer's timezone
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(initialQ);
  const filtered = rows;

  function go(next: { status?: InboundStatus | "all"; q?: string }) {
    const params = new URLSearchParams();
    const s = next.status ?? status;
    const text = (next.q ?? q).trim();
    if (s !== "all") params.set("status", s);
    if (text) params.set("q", text);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Search as you type, debounced.
  useEffect(() => {
    if (q.trim() === initialQ.trim()) return;
    const t = setTimeout(() => go({ q }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="User, sender or reason"
            aria-label="Search the log"
            className="h-9 pl-8"
          />
        </div>
        <select
          aria-label="Status"
          className={selectCls}
          value={status}
          onChange={(e) => go({ status: e.target.value as InboundStatus | "all" })}
        >
          <option value="all">All statuses</option>
          {(Object.keys(INBOUND_STATUS_LABELS) as InboundStatus[]).map((s) => (
            <option key={s} value={s}>
              {INBOUND_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Wide screens: table; below xl (next to the admin sidebar): stacked rows */}
      <Card className="hidden overflow-x-auto p-0 xl:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Received</th>
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">Sender</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Detail</th>
              <th className="px-4 py-2.5 text-right font-medium">Size</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
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
        {filtered.map((r) => (
          <li key={r.id} className="rounded-xl border bg-card p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <Badge variant={STATUS_VARIANT[r.status]}>{INBOUND_STATUS_LABELS[r.status]}</Badge>
              <span className="text-[11px] text-muted-foreground">{mounted ? formatDateTime(r.receivedAt) : ""}</span>
            </div>
            <p className="mt-1.5 truncate">{r.user ? r.user.name : <span className="text-muted-foreground">Unknown address</span>}</p>
            <p className="truncate font-mono text-[12px] text-muted-foreground">
              <SenderText row={r} />
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {r.reason} · {formatBytes(r.sizeBytes)}
            </p>
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {status === "all" && !initialQ ? "No emails received yet." : "No emails match these filters."}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        {filtered.length === pageSize ? `Newest ${pageSize} shown · narrow the filters to see older ones` : `${filtered.length} shown`} · kept 30 days · no email content is stored
      </p>
    </div>
  );
}

/** Full address for accepted job-site mail; the domain only for everything else. */
function SenderText({ row }: { row: InboundLogEntry }) {
  return <>{row.fromAddress ?? `…@${row.fromDomain}`}</>;
}
