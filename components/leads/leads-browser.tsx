"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Timer,
  CheckCircle2,
  Archive,
} from "lucide-react";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  type JobLead,
  type LeadStatus,
} from "@/lib/types";
import { StatusBadge } from "@/components/leads/status-badge";
import { LeadActions } from "@/components/leads/lead-actions";
import { LeadDetailDialog } from "@/components/leads/lead-detail-dialog";
import { mockResumes } from "@/lib/mock-data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | LeadStatus;
type LocationFilter = "all" | "remote";
type Sort = "newest" | "oldest";

const PAGE_SIZE = 15; // 3 columns × 5 rows on desktop.

const STATUS_META: Record<
  LeadStatus,
  { icon: typeof Sparkles; bar: string; chip: string; num: string; tint: string }
> = {
  new: {
    icon: Sparkles,
    bar: "bg-status-new-foreground",
    chip: "bg-status-new text-status-new-foreground",
    num: "text-status-new-foreground",
    tint: "from-status-new/40",
  },
  reviewing: {
    icon: Timer,
    bar: "bg-status-reviewing-foreground",
    chip: "bg-status-reviewing text-status-reviewing-foreground",
    num: "text-status-reviewing-foreground",
    tint: "from-status-reviewing/40",
  },
  applied: {
    icon: CheckCircle2,
    bar: "bg-status-applied-foreground",
    chip: "bg-status-applied text-status-applied-foreground",
    num: "text-status-applied-foreground",
    tint: "from-status-applied/45",
  },
  discarded: {
    icon: Archive,
    bar: "bg-status-discarded-foreground",
    chip: "bg-status-discarded text-status-discarded-foreground",
    num: "text-foreground",
    tint: "from-status-discarded/70",
  },
};

export function LeadsBrowser({ leads }: { leads: JobLead[] }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");
  // Default order is latest first (applies on mobile and desktop alike).
  const [sort, setSort] = useState<Sort>("newest");
  const [page, setPage] = useState(1);
  // Local status overrides so "Change status" from the row menu reflects live.
  const [overrides, setOverrides] = useState<Record<string, LeadStatus>>({});
  // Which lead's "View details" modal is open (null = closed).
  const [detailLead, setDetailLead] = useState<JobLead | null>(null);

  const statusOf = (lead: JobLead): LeadStatus =>
    overrides[lead.id] ?? lead.status;

  const setStatus = (id: string, status: LeadStatus) =>
    setOverrides((prev) => ({ ...prev, [id]: status }));

  const counts = useMemo(() => {
    const c: Record<LeadStatus, number> = {
      new: 0,
      reviewing: 0,
      applied: 0,
      discarded: 0,
    };
    for (const l of leads) c[statusOf(l)]++;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, overrides]);

  const visible = useMemo(() => {
    let out = leads.slice();
    if (statusFilter !== "all")
      out = out.filter((l) => statusOf(l) === statusFilter);
    if (locationFilter === "remote") out = out.filter((l) => l.remote);
    out.sort((a, b) =>
      sort === "newest"
        ? b.capturedAt.localeCompare(a.capturedAt)
        : a.capturedAt.localeCompare(b.capturedAt),
    );
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, statusFilter, locationFilter, sort, overrides]);

  // Reset to the first page whenever the result set changes.
  useEffect(() => {
    setPage(1);
  }, [statusFilter, locationFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = visible.slice(start, start + PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Metric row — each box also filters the list by that status */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {LEAD_STATUSES.map((s) => {
          const meta = STATUS_META[s];
          const Icon = meta.icon;
          const active = statusFilter === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => setStatusFilter(active ? "all" : s)}
              className={cn(
                "group relative overflow-hidden rounded-2xl border bg-gradient-to-br to-card p-3.5 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                meta.tint,
                active
                  ? "border-primary/50 ring-2 ring-primary/30"
                  : "border-transparent",
              )}
            >
              <span
                className={cn("absolute inset-y-0 left-0 w-1", meta.bar)}
                aria-hidden
              />
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-2xl font-semibold tabular-nums leading-none",
                    meta.num,
                  )}
                >
                  {counts[s]}
                </span>
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg shadow-xs",
                    meta.chip,
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
              </div>
              <div className="mt-2 text-xs font-medium text-foreground/70">
                {LEAD_STATUS_LABELS[s]}
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters — proper dropdowns */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <FilterSelect
          label="Status"
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          options={[
            { value: "all", label: "All statuses" },
            ...LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] })),
          ]}
        />
        <FilterSelect
          label="Location"
          value={locationFilter}
          onValueChange={(v) => setLocationFilter(v as LocationFilter)}
          options={[
            { value: "all", label: "All locations" },
            { value: "remote", label: "Remote only" },
          ]}
        />
        <FilterSelect
          label="Sort by"
          value={sort}
          onValueChange={(v) => setSort(v as Sort)}
          className="sm:ml-auto"
          options={[
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
          No leads match these filters.
        </div>
      ) : (
        <>
          {/* Card grid — 1 col on mobile, 2 on sm, 3 on lg. 15 cards per page. */}
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((lead) => (
              <li key={lead.id}>
                <LeadCard
                  lead={lead}
                  status={statusOf(lead)}
                  onOpen={() => setDetailLead(lead)}
                  onStatusChange={(s) => setStatus(lead.id, s)}
                />
              </li>
            ))}
          </ul>

          <Pagination
            page={currentPage}
            totalPages={totalPages}
            total={visible.length}
            start={start}
            shown={pageItems.length}
            onPage={setPage}
          />
        </>
      )}

      <LeadDetailDialog
        lead={detailLead}
        resumes={mockResumes}
        status={detailLead ? statusOf(detailLead) : undefined}
        onStatusChange={
          detailLead ? (s) => setStatus(detailLead.id, s) : undefined
        }
        open={detailLead !== null}
        onOpenChange={(o) => !o && setDetailLead(null)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Filter dropdown                                                     */
/* ------------------------------------------------------------------ */

function FilterSelect({
  label,
  value,
  onValueChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2", className)}>
      <span className="text-xs font-medium text-muted-foreground sm:sr-only">
        {label}
      </span>
      <Select value={value} onValueChange={(v) => onValueChange(v ?? value)}>
        <SelectTrigger
          aria-label={label}
          className="min-h-11 w-full sm:min-h-9 sm:w-auto sm:min-w-40"
        >
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

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

function Pagination({
  page,
  totalPages,
  total,
  start,
  shown,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  start: number;
  shown: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return (
      <p className="text-center text-xs text-muted-foreground sm:text-left">
        {total} {total === 1 ? "lead" : "leads"}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-xs text-muted-foreground">
        Showing {start + 1}–{start + shown} of {total}
      </p>
      <div className="flex items-center gap-1">
        <PageButton
          disabled={page === 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </PageButton>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
          <PageButton
            key={n}
            active={n === page}
            onClick={() => onPage(n)}
            aria-label={`Page ${n}`}
            aria-current={n === page ? "page" : undefined}
          >
            {n}
          </PageButton>
        ))}
        <PageButton
          disabled={page === totalPages}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" aria-hidden />
        </PageButton>
      </div>
    </div>
  );
}

function PageButton({
  active,
  disabled,
  onClick,
  children,
  ...props
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
} & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-lg border text-sm font-medium tabular-nums transition-colors sm:size-9",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Lead card                                                           */
/* ------------------------------------------------------------------ */

function LeadCard({
  lead,
  status,
  onOpen,
  onStatusChange,
}: {
  lead: JobLead;
  status: LeadStatus;
  onOpen: () => void;
  onStatusChange: (status: LeadStatus) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`View details for ${lead.title}`}
      className="group relative flex h-full cursor-pointer flex-col rounded-2xl border bg-card p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm leading-snug font-medium group-hover:text-primary">
          {lead.title}
        </h3>
        {/* Actions cluster stops propagation so it doesn't open the modal. */}
        <div
          className="flex shrink-0 items-center gap-1"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <StatusBadge status={status} />
          <LeadActions
            lead={lead}
            resumes={mockResumes}
            status={status}
            onStatusChange={onStatusChange}
            onViewDetails={onOpen}
            className="-mr-1 size-11 sm:size-9"
          />
        </div>
      </div>
      <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="size-3.5 shrink-0" aria-hidden />
        {lead.company} · {lead.location}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
        {lead.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-md bg-ai-muted px-2 py-0.5 text-[11px] font-medium text-ai"
          >
            {tag}
          </span>
        ))}
        {lead.remote && (
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            Remote
          </span>
        )}
        {lead.contactCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            <Users className="size-3" aria-hidden />
            {lead.contactCount}
          </span>
        )}
        {lead.hasDueReminder && (
          <span className="inline-flex items-center gap-1 rounded-md bg-status-reviewing px-2 py-0.5 text-[11px] font-medium text-status-reviewing-foreground">
            <Clock className="size-3" aria-hidden />
            Follow-up due
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {lead.postedRelative}
        </span>
      </div>
    </div>
  );
}
