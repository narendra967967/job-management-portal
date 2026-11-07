"use client";

// Shared pieces for admin data tables (owner rule: every data listing is a
// table at every width, with multi-select, an Action column, pagination and
// filters; activity logs default to the last 7 days with required dates).
// Reference: components/admin/orders/orders-client.tsx.

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal, X } from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/admin/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const tableCheckboxCls = "size-4 shrink-0 cursor-pointer rounded border-input accent-primary";
export const tableSelectCls =
  "h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** The table's bordered box; scrolls sideways on small screens so the page doesn't. */
export function TableBox({ minWidth, children }: { minWidth: number; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

/* ---------------- selection ---------------- */

export interface RowSelection {
  selected: Set<string>;
  count: number;
  isSelected: (id: string) => boolean;
  toggleOne: (id: string) => void;
  toggleAll: () => void;
  clear: () => void;
  allSelected: boolean;
  headerRef: React.RefObject<HTMLInputElement | null>;
}

/** Multi-select over the rows currently matching the filters. Selections of
 *  rows that disappear (deleted, filtered out) are dropped. */
export function useRowSelection(visibleIds: string[]): RowSelection {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const idsKey = visibleIds.join("|");
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = visibleIds.some((id) => selected.has(id)) && !allSelected;
  const headerRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (headerRef.current) headerRef.current.indeterminate = someSelected;
  }, [someSelected]);
  // Drop selections that are no longer in the list.
  useEffect(() => {
    const visible = new Set(idsKey ? idsKey.split("|") : []);
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [idsKey]);

  return {
    selected,
    count: selected.size,
    isSelected: (id) => selected.has(id),
    toggleOne: (id) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    toggleAll: () =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (allSelected) visibleIds.forEach((id) => next.delete(id));
        else visibleIds.forEach((id) => next.add(id));
        return next;
      }),
    clear: () => setSelected(new Set()),
    allSelected,
    headerRef,
  };
}

export function SelectAllCheckbox({ selection }: { selection: RowSelection }) {
  return (
    <input
      ref={selection.headerRef}
      type="checkbox"
      className={tableCheckboxCls}
      checked={selection.allSelected}
      onChange={selection.toggleAll}
      aria-label="Select all"
    />
  );
}

export function RowCheckbox({ selection, id, label }: { selection: RowSelection; id: string; label: string }) {
  return (
    <input
      type="checkbox"
      className={tableCheckboxCls}
      checked={selection.isSelected(id)}
      onChange={() => selection.toggleOne(id)}
      aria-label={`Select ${label}`}
    />
  );
}

/** "N selected" bar with the bulk actions and Clear. */
export function BulkBar({ selection, children }: { selection: RowSelection; children: React.ReactNode }) {
  if (selection.count === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
      <span className="font-medium">{selection.count} selected</span>
      <div className="ml-auto flex flex-wrap gap-2">
        {children}
        <Button variant="ghost" size="sm" onClick={selection.clear}>
          <X className="size-4" /> Clear
        </Button>
      </div>
    </div>
  );
}

/* ---------------- row actions ---------------- */

/** The ⋯ menu in a row's Action column. Children are DropdownMenuItems. */
export function RowActions({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${label}`}
        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------------- pagination ---------------- */

export interface Paging<T> {
  paged: T[];
  start: number;
  total: number;
  current: number;
  pageCount: number;
  pageSize: number;
  setPage: (p: number) => void;
  setPageSize: (n: number) => void;
}

/** Client-side paging; back to page 1 whenever `resetKey` (the filters) changes. */
export function usePagination<T>(items: T[], resetKey: string): Paging<T> {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => setPage(1), [resetKey, pageSize]);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const paged = useMemo(() => items.slice(start, start + pageSize), [items, start, pageSize]);
  return { paged, start, total: items.length, current, pageCount, pageSize, setPage, setPageSize };
}

export function TablePagination<T>({ paging }: { paging: Paging<T> }) {
  const { start, total, current, pageCount, pageSize, setPage, setPageSize } = paging;
  if (total === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted-foreground">
        Showing {start + 1}–{Math.min(start + pageSize, total)} of {total}
      </span>
      <label className="flex items-center gap-1.5 text-muted-foreground">
        Rows
        <select className={tableSelectCls + " h-8"} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
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
  );
}

/* ---------------- date range (activity logs) ---------------- */

/** yyyy-mm-dd in the viewer's timezone. */
export function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The last `days` days, today included. */
export function lastDays(days = 7): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { from: ymd(from), to: ymd(to) };
}

export function dateRangeError(from: string, to: string): string {
  if (!from || !to) return "Pick both a from and a to date.";
  if (from > to) return "The from date must be on or before the to date.";
  return "";
}

/** From / To inputs (both required). */
export function DateRangeFields({
  from,
  to,
  onFrom,
  onTo,
  error,
}: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  error: string;
}) {
  return (
    <>
      <label className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
        From
        <Input
          type="date"
          required
          value={from}
          max={to || undefined}
          onChange={(e) => onFrom(e.target.value)}
          aria-invalid={!!error}
          className="h-9 w-[9.5rem]"
        />
      </label>
      <label className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
        To
        <Input
          type="date"
          required
          value={to}
          min={from || undefined}
          onChange={(e) => onTo(e.target.value)}
          aria-invalid={!!error}
          className="h-9 w-[9.5rem]"
        />
      </label>
    </>
  );
}

/* ---------------- stat boxes ---------------- */

/** A stat above a list that doubles as a filter: click to apply, click again to clear. */
export function StatBox({
  label,
  value,
  active,
  onClick,
  className,
}: {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-xl border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/40",
        active && "border-primary bg-primary/5 ring-2 ring-primary/20",
        className,
      )}
    >
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
    </button>
  );
}
