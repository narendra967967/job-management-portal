"use client";

// Reusable lead filters (everything except status) — the "Filters" button plus
// a slide-in drawer, the pure apply function, and an active-count helper. The
// Kanban view uses this since status is represented by its columns; the list
// view keeps its own inline copy.

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal, X } from "lucide-react";
import type { JobLead } from "@/lib/types";
import { countryOf } from "@/components/leads/leads-browser";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type DateRange = "all" | "7d" | "30d" | "90d" | "custom";

export interface LeadFilterValue {
  location: "all" | "remote";
  country: string;
  title: string;
  tag: string;
  dateRange: DateRange;
  customFrom: string;
  customTo: string;
}

export const EMPTY_LEAD_FILTERS: LeadFilterValue = {
  location: "all",
  country: "all",
  title: "all",
  tag: "all",
  dateRange: "all",
  customFrom: "",
  customTo: "",
};

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function dateBounds(v: LeadFilterValue): { from: string | null; to: string | null } {
  if (v.dateRange === "custom") {
    return { from: v.customFrom || null, to: v.customTo || null };
  }
  const days =
    v.dateRange === "7d" ? 7 : v.dateRange === "30d" ? 30 : v.dateRange === "90d" ? 90 : null;
  if (days === null) return { from: null, to: null };
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { from: toISODate(from), to: null };
}

/** Apply the non-status filters to a set of leads. */
export function applyLeadFilters(leads: JobLead[], v: LeadFilterValue): JobLead[] {
  let out = leads;
  if (v.location === "remote") out = out.filter((l) => l.remote);
  if (v.country !== "all") out = out.filter((l) => countryOf(l.location) === v.country);
  if (v.title !== "all") out = out.filter((l) => l.title === v.title);
  if (v.tag !== "all") out = out.filter((l) => l.tags.includes(v.tag));
  const { from, to } = dateBounds(v);
  if (from) out = out.filter((l) => l.capturedAt >= from);
  if (to) out = out.filter((l) => l.capturedAt <= to);
  return out;
}

export function countActiveLeadFilters(v: LeadFilterValue): number {
  return (
    (v.location !== "all" ? 1 : 0) +
    (v.country !== "all" ? 1 : 0) +
    (v.title !== "all" ? 1 : 0) +
    (v.tag !== "all" ? 1 : 0) +
    (v.dateRange !== "all" ? 1 : 0)
  );
}

export function LeadFilters({
  leads,
  value,
  onChange,
}: {
  /** Full lead set the options (country/title/tag) are derived from. */
  leads: JobLead[];
  value: LeadFilterValue;
  onChange: (next: LeadFilterValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<LeadFilterValue>) => onChange({ ...value, ...patch });
  const activeCount = countActiveLeadFilters(value);
  const resultCount = useMemo(
    () => applyLeadFilters(leads, value).length,
    [leads, value],
  );

  const countries = useMemo(
    () =>
      [...new Set(leads.map((l) => countryOf(l.location)))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [leads],
  );
  const titles = useMemo(
    () => [...new Set(leads.map((l) => l.title))].sort((a, b) => a.localeCompare(b)),
    [leads],
  );
  const tags = useMemo(() => [...new Set(leads.flatMap((l) => l.tags))].sort(), [leads]);

  const clearAll = () => onChange(EMPTY_LEAD_FILTERS);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium shadow-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Filters
          {activeCount > 0 && (
            <span className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
              {activeCount}
            </span>
          )}
        </button>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        )}
      </div>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              aria-label="Close filters"
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/40"
            />
            <aside className="absolute inset-y-0 right-0 flex w-80 max-w-[88%] flex-col border-l bg-card shadow-xl">
              <div className="flex items-center justify-between border-b p-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <SlidersHorizontal className="size-4" aria-hidden />
                  Filters
                  {activeCount > 0 && (
                    <span className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
                      {activeCount}
                    </span>
                  )}
                </h2>
                <button
                  type="button"
                  aria-label="Close filters"
                  onClick={() => setOpen(false)}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <DrawerSelect
                  label="Workplace"
                  value={value.location}
                  onValueChange={(v) => set({ location: v as "all" | "remote" })}
                  options={[
                    { value: "all", label: "All" },
                    { value: "remote", label: "Remote only" },
                  ]}
                />
                {countries.length > 0 && (
                  <DrawerSelect
                    label="Country"
                    value={value.country}
                    onValueChange={(v) => set({ country: v })}
                    options={[
                      { value: "all", label: "All countries" },
                      ...countries.map((c) => ({ value: c, label: c })),
                    ]}
                  />
                )}
                {titles.length > 0 && (
                  <DrawerSelect
                    label="Title"
                    value={value.title}
                    onValueChange={(v) => set({ title: v })}
                    options={[
                      { value: "all", label: "All titles" },
                      ...titles.map((t) => ({ value: t, label: t })),
                    ]}
                  />
                )}
                {tags.length > 0 && (
                  <DrawerSelect
                    label="Tag"
                    value={value.tag}
                    onValueChange={(v) => set({ tag: v })}
                    options={[
                      { value: "all", label: "All tags" },
                      ...tags.map((t) => ({ value: t, label: t })),
                    ]}
                  />
                )}
                <DrawerSelect
                  label="Captured"
                  value={value.dateRange}
                  onValueChange={(v) => set({ dateRange: v as DateRange })}
                  options={[
                    { value: "all", label: "Any time" },
                    { value: "7d", label: "Last 7 days" },
                    { value: "30d", label: "Last 30 days" },
                    { value: "90d", label: "Last 90 days" },
                    { value: "custom", label: "Custom range…" },
                  ]}
                />
                {value.dateRange === "custom" && (
                  <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
                    <DateField
                      label="From"
                      value={value.customFrom}
                      max={value.customTo || undefined}
                      onChange={(v) => set({ customFrom: v })}
                    />
                    <DateField
                      label="To"
                      value={value.customTo}
                      min={value.customFrom || undefined}
                      onChange={(v) => set({ customTo: v })}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 border-t p-4">
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={activeCount === 0}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Show {resultCount} {resultCount === 1 ? "lead" : "leads"}
                </button>
              </div>
            </aside>
          </div>,
          document.body,
        )}
    </>
  );
}

function DrawerSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select
        items={Object.fromEntries(options.map((o) => [o.value, o.label]))}
        value={value}
        onValueChange={(v) => onValueChange(v ?? value)}
      >
        <SelectTrigger aria-label={label} className="min-h-10 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function DateField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-1 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full sm:min-h-9"
      />
    </label>
  );
}
