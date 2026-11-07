"use client";

// Admin → Orders & Payments: every plan purchase attempt with its status,
// user, plan, amount and gateway references. Table on wide screens, stacked
// rows below xl (next to the admin sidebar).
//
// PHASE 1: sample data (lib/payments-mock.ts). Phase 3 loads real orders and
// filters in the database.

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/admin/ui/input";
import { Badge } from "@/components/admin/ui/badge";
import { Card } from "@/components/admin/ui/card";
import {
  GATEWAY_LABELS,
  ORDER_STATUS_LABELS,
  PERIOD_LABELS,
  formatPaise,
  type AdminOrderRow,
  type GatewayId,
  type OrderStatus,
} from "@/lib/billing-model";
import { mockOrders } from "@/lib/payments-mock";
import { useMounted } from "@/lib/use-mounted";
import { formatDateTime } from "@/lib/utils";

const STATUS_VARIANT: Record<OrderStatus, "success" | "danger" | "warning" | "neutral"> = {
  paid: "success",
  failed: "danger",
  created: "warning",
  cancelled: "neutral",
};

const KIND_LABELS = { new: "New", renew: "Renewal", upgrade: "Upgrade" } as const;

const selectCls =
  "h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function OrdersClient() {
  const mounted = useMounted(); // sample timestamps use the clock
  const rows = useMemo(() => (mounted ? mockOrders() : []), [mounted]);
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [q, setQ] = useState("");

  const filtered = rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return [r.user?.name, r.user?.email, r.planName, r.gatewayOrderId, r.gatewayPaymentId]
      .filter(Boolean)
      .some((v) => (v as string).toLowerCase().includes(needle));
  });

  const paid = rows.filter((r) => r.status === "paid");
  const paidTotal = paid.reduce((sum, r) => sum + r.total, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="User, plan or payment ID"
            aria-label="Search orders"
            className="h-9 pl-8"
          />
        </div>
        <select aria-label="Status" className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | "all")}>
          <option value="all">All statuses</option>
          {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <span className="ml-auto rounded-md border border-dashed border-amber-400 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Sample data
        </span>
      </div>

      {mounted && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Paid" value={formatPaise(paidTotal, "INR")} />
          <Stat label="Paid orders" value={String(paid.length)} />
          <Stat label="Failed" value={String(rows.filter((r) => r.status === "failed").length)} />
          <Stat label="Pending" value={String(rows.filter((r) => r.status === "created").length)} />
        </div>
      )}

      <Card className="hidden overflow-x-auto p-0 xl:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">Plan</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Amount</th>
              <th className="px-4 py-2.5 font-medium">Gateway</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b align-top last:border-0 hover:bg-muted/40">
                <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{formatDateTime(r.createdAt)}</td>
                <td className="px-4 py-2.5">
                  <span className="block truncate">{r.user?.name ?? "Deleted user"}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.user?.email}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="block">{r.planName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {PERIOD_LABELS[r.period]} · {KIND_LABELS[r.kind]}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant={STATUS_VARIANT[r.status]}>{ORDER_STATUS_LABELS[r.status]}</Badge>
                  {r.failureReason && <span className="mt-1 block text-xs text-muted-foreground">{r.failureReason}</span>}
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">{formatPaise(r.total, r.currency)}</td>
                <td className="px-4 py-2.5 text-xs">
                  <GatewayRefs row={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <ul className="space-y-2 xl:hidden">
        {filtered.map((r) => (
          <li key={r.id} className="rounded-xl border bg-card p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <Badge variant={STATUS_VARIANT[r.status]}>{ORDER_STATUS_LABELS[r.status]}</Badge>
              <span className="font-medium tabular-nums">{formatPaise(r.total, r.currency)}</span>
            </div>
            <p className="mt-1.5 truncate">{r.user?.name ?? "Deleted user"}</p>
            <p className="text-xs text-muted-foreground">
              {r.planName} · {PERIOD_LABELS[r.period]} · {KIND_LABELS[r.kind]}
            </p>
            {r.failureReason && <p className="mt-1 text-xs text-muted-foreground">{r.failureReason}</p>}
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <GatewayRefs row={r} />
              <span>{formatDateTime(r.createdAt)}</span>
            </div>
          </li>
        ))}
      </ul>

      {mounted && filtered.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {rows.length === 0 ? "No orders yet." : "No orders match these filters."}
        </p>
      )}
    </div>
  );
}

function GatewayRefs({ row }: { row: AdminOrderRow }) {
  return (
    <span className="block min-w-0">
      <span className="block">
        {GATEWAY_LABELS[row.gateway as GatewayId] ?? row.gateway}
        {row.mode === "test" && <span className="ml-1 text-muted-foreground">(test)</span>}
      </span>
      <span className="block font-mono break-all text-muted-foreground">{row.gatewayPaymentId ?? row.gatewayOrderId}</span>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}
