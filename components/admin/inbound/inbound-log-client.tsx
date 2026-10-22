"use client";

// Inbound email log (A5): filter by status / user / environment. Shows
// metadata only — rejected mail keeps just the sender's domain. Rows are
// purged after 30 days. PHASE 2: sample data (lib/email-intake-mock.ts).

import { useMemo, useState } from "react";
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
import { mockLog } from "@/lib/email-intake-mock";
import { useMounted } from "@/lib/use-mounted";
import { cn, formatDateTime } from "@/lib/utils";

const STATUS_VARIANT: Record<InboundStatus, "success" | "danger" | "warning" | "neutral"> = {
  accepted: "success",
  rejected: "danger",
  unsupported: "warning",
  duplicate: "neutral",
  gmail_code: "neutral",
};

const selectCls =
  "h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function InboundLogClient() {
  const mounted = useMounted(); // sample timestamps use the clock
  const rows = useMemo(() => (mounted ? mockLog() : []), [mounted]);
  const [status, setStatus] = useState<InboundStatus | "all">("all");
  const [env, setEnv] = useState<"all" | "prod" | "preprod">("all");
  const [q, setQ] = useState("");

  const filtered = rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (env !== "all" && r.env !== env) return false;
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return [r.user?.name, r.user?.email, r.fromAddress, r.fromDomain, r.reason]
      .filter(Boolean)
      .some((v) => (v as string).toLowerCase().includes(needle));
  });

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
          onChange={(e) => setStatus(e.target.value as InboundStatus | "all")}
        >
          <option value="all">All statuses</option>
          {(Object.keys(INBOUND_STATUS_LABELS) as InboundStatus[]).map((s) => (
            <option key={s} value={s}>
              {INBOUND_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          aria-label="Environment"
          className={selectCls}
          value={env}
          onChange={(e) => setEnv(e.target.value as "all" | "prod" | "preprod")}
        >
          <option value="all">Prod + preprod</option>
          <option value="prod">Prod</option>
          <option value="preprod">Preprod</option>
        </select>
        <span className="ml-auto rounded-md border border-dashed border-amber-400 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Sample data
        </span>
      </div>

      {/* Desktop/tablet table */}
      <Card className="hidden overflow-x-auto p-0 md:block">
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
                  {formatDateTime(r.receivedAt)}
                  {r.env === "preprod" && <span className="ml-1.5 text-[10px] text-primary">preprod</span>}
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

      {/* Phone: stacked rows */}
      <ul className="space-y-2 md:hidden">
        {filtered.map((r) => (
          <li key={r.id} className="rounded-xl border bg-card p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <Badge variant={STATUS_VARIANT[r.status]}>{INBOUND_STATUS_LABELS[r.status]}</Badge>
              <span className="text-[11px] text-muted-foreground">{formatDateTime(r.receivedAt)}</span>
            </div>
            <p className="mt-1.5 truncate">{r.user ? r.user.name : <span className="text-muted-foreground">Unknown address</span>}</p>
            <p className="truncate font-mono text-[12px] text-muted-foreground">
              <SenderText row={r} />
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {r.reason} · {formatBytes(r.sizeBytes)}
              {r.env === "preprod" ? " · preprod" : ""}
            </p>
          </li>
        ))}
      </ul>

      {mounted && filtered.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">No emails match these filters.</p>
      )}
      <p className={cn("text-[11px] text-muted-foreground", !mounted && "hidden")}>
        {filtered.length} of {rows.length} · kept 30 days · no email content is stored
      </p>
    </div>
  );
}

/** Full address for accepted job-site mail; the domain only for everything else. */
function SenderText({ row }: { row: InboundLogEntry }) {
  return <>{row.fromAddress ?? `…@${row.fromDomain}`}</>;
}
