"use client";

// Admin → Orders & Payments: every plan purchase attempt with its status,
// user, plan, amount and gateway references. Table at every width (inside a
// horizontal scroller on small screens), multi-select with CSV export, an
// action menu per row, pagination, and filters. The date range is required and
// defaults to the last 7 days; the stat boxes double as status filters.
//
// PHASE 1: sample data (lib/payments-mock.ts). Phase 3 loads real orders and
// filters in the database.

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Download, Eye, MoreHorizontal, Search, X } from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Badge } from "@/components/admin/ui/badge";
import { toast } from "@/components/admin/ui/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/admin/ui/dialog";
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
import { cn, formatDateTime } from "@/lib/utils";

const STATUS_VARIANT: Record<OrderStatus, "success" | "danger" | "warning" | "neutral"> = {
  paid: "success",
  failed: "danger",
  created: "warning",
  cancelled: "neutral",
};

const KIND_LABELS = { new: "New", renew: "Renewal", upgrade: "Upgrade" } as const;

const selectCls =
  "h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const checkboxCls = "size-4 shrink-0 cursor-pointer rounded border-input accent-primary";

/** yyyy-mm-dd in the viewer's timezone. */
function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6); // today + the 6 days before = 7 days
  return { from: ymd(from), to: ymd(to) };
}

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function OrdersClient() {
  const mounted = useMounted(); // sample timestamps use the clock
  const rows = useMemo(() => (mounted ? mockOrders() : []), [mounted]);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [plan, setPlan] = useState("all");
  const [gateway, setGateway] = useState("all");
  const [fromInput, setFromInput] = useState(() => defaultRange().from);
  const [toInput, setToInput] = useState(() => defaultRange().to);
  const [range, setRange] = useState(defaultRange);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<AdminOrderRow | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Both dates are required; the table keeps the last valid range meanwhile.
  const rangeError = !fromInput || !toInput
    ? "Pick both a from and a to date."
    : fromInput > toInput
      ? "The from date must be on or before the to date."
      : "";
  useEffect(() => {
    if (!rangeError) setRange({ from: fromInput, to: toInput });
  }, [fromInput, toInput, rangeError]);

  // Everything inside the date range: the stat boxes count from this.
  const inRange = useMemo(
    () =>
      rows.filter((r) => {
        const d = ymd(new Date(r.createdAt));
        return d >= range.from && d <= range.to;
      }),
    [rows, range],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return inRange.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (plan !== "all" && r.planName !== plan) return false;
      if (gateway !== "all" && r.gateway !== gateway) return false;
      if (!needle) return true;
      return [r.user?.name, r.user?.email, r.planName, r.gatewayOrderId, r.gatewayPaymentId]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(needle));
    });
  }, [inRange, query, status, plan, gateway]);

  useEffect(() => setPage(1), [query, status, plan, gateway, range, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  const filteredIds = filtered.map((r) => r.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someSelected = filteredIds.some((id) => selected.has(id)) && !allSelected;
  const headerRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerRef.current) headerRef.current.indeterminate = someSelected;
  }, [someSelected]);

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

  const plans = useMemo(() => [...new Set(rows.map((r) => r.planName))].sort(), [rows]);
  const gateways = useMemo(() => [...new Set(rows.map((r) => r.gateway))].sort(), [rows]);

  const paid = inRange.filter((r) => r.status === "paid");
  const stats: { label: string; value: string; status: OrderStatus }[] = [
    { label: "Paid", value: formatPaise(paid.reduce((s, r) => s + r.total, 0), "INR"), status: "paid" },
    { label: "Paid orders", value: String(paid.length), status: "paid" },
    { label: "Failed", value: String(inRange.filter((r) => r.status === "failed").length), status: "failed" },
    { label: "Pending", value: String(inRange.filter((r) => r.status === "created").length), status: "created" },
    { label: "Cancelled", value: String(inRange.filter((r) => r.status === "cancelled").length), status: "cancelled" },
  ];

  async function copy(value: string | null, what: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${what} copied`);
    } catch {
      toast.error(`Couldn't copy the ${what.toLowerCase()}`);
    }
  }

  function exportSelected() {
    const chosen = rows.filter((r) => selected.has(r.id));
    const header = ["Date", "User", "Email", "Plan", "Period", "Type", "Status", "Amount", "Currency", "Gateway", "Mode", "Order ID", "Payment ID", "Failure reason"];
    const lines = chosen.map((r) =>
      [
        r.createdAt,
        r.user?.name,
        r.user?.email,
        r.planName,
        PERIOD_LABELS[r.period],
        KIND_LABELS[r.kind],
        ORDER_STATUS_LABELS[r.status],
        (r.total / 100).toFixed(2),
        r.currency,
        GATEWAY_LABELS[r.gateway as GatewayId] ?? r.gateway,
        r.mode,
        r.gatewayOrderId,
        r.gatewayPaymentId,
        r.failureReason,
      ]
        .map(csvCell)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${range.from}-to-${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const selCount = selected.size;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative w-full sm:w-auto sm:min-w-0 sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
        <select aria-label="Plan" className={selectCls} value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="all">All plans</option>
          {plans.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select aria-label="Gateway" className={selectCls} value={gateway} onChange={(e) => setGateway(e.target.value)}>
          <option value="all">All gateways</option>
          {gateways.map((g) => (
            <option key={g} value={g}>
              {GATEWAY_LABELS[g as GatewayId] ?? g}
            </option>
          ))}
        </select>
        <label className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
          From
          <Input
            type="date"
            required
            value={fromInput}
            max={toInput || undefined}
            onChange={(e) => setFromInput(e.target.value)}
            aria-invalid={!!rangeError}
            className="h-9 w-[9.5rem]"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
          To
          <Input
            type="date"
            required
            value={toInput}
            min={fromInput || undefined}
            onChange={(e) => setToInput(e.target.value)}
            aria-invalid={!!rangeError}
            className="h-9 w-[9.5rem]"
          />
        </label>
        <span className="ml-auto self-center rounded-md border border-dashed border-amber-400 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Sample data
        </span>
      </div>
      {rangeError && <p className="-mt-2 text-xs text-destructive">{rangeError}</p>}

      {/* Stat boxes: click to filter by that status, click again to clear */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s, i) => {
          const active = status === s.status;
          return (
            <button
              key={s.label}
              type="button"
              aria-pressed={active}
              onClick={() => setStatus(active ? "all" : s.status)}
              className={cn(
                "rounded-xl border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/40",
                i === 0 && "col-span-2 sm:col-span-1", // the money total gets a full row on phones
                active && "border-primary bg-primary/5 ring-2 ring-primary/20",
              )}
            >
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
              <p className="mt-0.5 text-base font-semibold tabular-nums">{mounted ? s.value : "–"}</p>
            </button>
          );
        })}
      </div>

      {/* Bulk actions */}
      {selCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{selCount} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportSelected}>
              <Download className="size-4" /> Export CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              <X className="size-4" /> Clear
            </Button>
          </div>
        </div>
      )}

      {/* Table (scrolls sideways inside its box on small screens) */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="w-10 px-3 py-2.5">
                <input ref={headerRef} type="checkbox" className={checkboxCls} checked={allSelected} onChange={toggleAll} aria-label="Select all" />
              </th>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">Plan</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Amount</th>
              <th className="px-4 py-2.5 font-medium">Gateway</th>
              <th className="px-4 py-2.5 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => (
              <tr
                key={r.id}
                className={cn("border-b border-border align-top last:border-0 hover:bg-muted/40", selected.has(r.id) && "bg-primary/5")}
              >
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    className={checkboxCls}
                    checked={selected.has(r.id)}
                    onChange={() => toggleOne(r.id)}
                    aria-label={`Select order ${r.gatewayOrderId ?? r.id}`}
                  />
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{formatDateTime(r.createdAt)}</td>
                <td className="px-4 py-2.5">
                  <span className="block truncate">{r.user?.name ?? "Deleted user"}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.user?.email}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="block">{r.planName}</span>
                  <span className="block text-xs whitespace-nowrap text-muted-foreground">
                    {PERIOD_LABELS[r.period]} · {KIND_LABELS[r.kind]}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant={STATUS_VARIANT[r.status]}>{ORDER_STATUS_LABELS[r.status]}</Badge>
                  {r.failureReason && <span className="mt-1 block text-xs text-muted-foreground">{r.failureReason}</span>}
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">{formatPaise(r.total, r.currency)}</td>
                <td className="px-4 py-2.5 text-xs">
                  <span className="block">
                    {GATEWAY_LABELS[r.gateway as GatewayId] ?? r.gateway}
                    {r.mode === "test" && <span className="ml-1 text-muted-foreground">(test)</span>}
                  </span>
                  <span className="block font-mono text-muted-foreground">{r.gatewayPaymentId ?? r.gatewayOrderId}</span>
                </td>
                <td className="px-4 py-2 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`Actions for order ${r.gatewayOrderId ?? r.id}`}
                      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <MoreHorizontal className="size-4" aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setDetails(r);
                          setDetailsOpen(true);
                        }}
                      >
                        <Eye /> View details
                      </DropdownMenuItem>
                      {r.gatewayPaymentId && (
                        <DropdownMenuItem onClick={() => copy(r.gatewayPaymentId, "Payment ID")}>
                          <Copy /> Copy payment ID
                        </DropdownMenuItem>
                      )}
                      {r.gatewayOrderId && (
                        <DropdownMenuItem onClick={() => copy(r.gatewayOrderId, "Order ID")}>
                          <Copy /> Copy order ID
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
            {mounted && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {inRange.length === 0 ? "No orders in these dates." : "No orders match these filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            Showing {start + 1}–{Math.min(start + pageSize, filtered.length)} of {filtered.length}
          </span>
          <label className="flex items-center gap-1.5 text-muted-foreground">
            Rows
            <select className={selectCls + " h-8"} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              <option>10</option>
              <option>25</option>
              <option>50</option>
            </select>
          </label>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>
              <ChevronLeft className="size-4" /> Prev
            </Button>
            <span className="text-muted-foreground">
              Page {current} of {pageCount}
            </span>
            <Button variant="outline" size="sm" disabled={current >= pageCount} onClick={() => setPage(current + 1)}>
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Always mounted; open toggles (Base UI dialog pattern used across admin). */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Order details</DialogTitle>
          </DialogHeader>
          {details && (
            <dl className="space-y-2 text-sm">
              <Detail label="Status">
                <Badge variant={STATUS_VARIANT[details.status]}>{ORDER_STATUS_LABELS[details.status]}</Badge>
              </Detail>
              {details.failureReason && <Detail label="Reason">{details.failureReason}</Detail>}
              <Detail label="User">
                {details.user ? (
                  <>
                    {details.user.name}
                    <span className="block text-xs text-muted-foreground">{details.user.email}</span>
                  </>
                ) : (
                  "Deleted user"
                )}
              </Detail>
              <Detail label="Plan">
                {details.planName} · {PERIOD_LABELS[details.period]} · {KIND_LABELS[details.kind]}
              </Detail>
              <Detail label="Amount">{formatPaise(details.total, details.currency)}</Detail>
              <Detail label="Created">{formatDateTime(details.createdAt)}</Detail>
              {details.paidAt && <Detail label="Paid">{formatDateTime(details.paidAt)}</Detail>}
              <Detail label="Gateway">
                {GATEWAY_LABELS[details.gateway as GatewayId] ?? details.gateway} ({details.mode})
              </Detail>
              <Detail label="Order ID">
                <span className="font-mono text-xs break-all">{details.gatewayOrderId ?? "–"}</span>
              </Detail>
              <Detail label="Payment ID">
                <span className="font-mono text-xs break-all">{details.gatewayPaymentId ?? "–"}</span>
              </Detail>
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
