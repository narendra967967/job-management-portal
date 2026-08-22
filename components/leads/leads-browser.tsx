"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Timer,
  CheckCircle2,
  Archive,
  UserPlus,
  BellPlus,
  Send,
  ExternalLink,
  Gauge,
} from "lucide-react";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  type JobLead,
  type LeadStatus,
} from "@/lib/types";
import { StatusBadge } from "@/components/leads/status-badge";
import { useLeadActionDialogs } from "@/components/leads/lead-actions";
import { LeadDetailDialog } from "@/components/leads/lead-detail-dialog";
import { mockResumes } from "@/lib/mock-data";
import { computeFitScore, fitBand } from "@/lib/fit";
import { useDefaultResumeId } from "@/lib/use-default-resume";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | LeadStatus;
type LocationFilter = "all" | "remote";
type DateRange = "all" | "7d" | "30d" | "90d" | "custom";
type Sort = "newest" | "oldest";

const PAGE_SIZE = 15; // 3 columns × 5 rows on desktop.

/** Local YYYY-MM-DD (matches the format of JobLead.capturedAt). */
function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

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
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  // Default order is latest first (applies on mobile and desktop alike).
  const [sort, setSort] = useState<Sort>("newest");
  const [page, setPage] = useState(1);
  // Local status overrides so "Change status" from the row menu reflects live.
  const [overrides, setOverrides] = useState<Record<string, LeadStatus>>({});
  // Which lead's "View details" modal is open (null = closed).
  const [detailLead, setDetailLead] = useState<JobLead | null>(null);
  // Default resume drives the fit score; per-lead choices override it.
  const [defaultResumeId] = useDefaultResumeId();
  const [resumeChoice, setResumeChoice] = useState<Record<string, string>>({});

  const resumeIdFor = (id: string) => resumeChoice[id] || defaultResumeId;
  const setResumeFor = (id: string, resumeId: string) =>
    setResumeChoice((prev) => ({ ...prev, [id]: resumeId }));

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

  // Resolve the active capture-date window [from, to] (inclusive, YYYY-MM-DD).
  const dateBounds = useMemo(() => {
    if (dateRange === "custom") {
      return { from: customFrom || null, to: customTo || null };
    }
    const days =
      dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : dateRange === "90d" ? 90 : null;
    if (days === null) return { from: null as string | null, to: null as string | null };
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    return { from: toISODate(from), to: null as string | null };
  }, [dateRange, customFrom, customTo]);

  const visible = useMemo(() => {
    let out = leads.slice();
    if (statusFilter !== "all")
      out = out.filter((l) => statusOf(l) === statusFilter);
    if (locationFilter === "remote") out = out.filter((l) => l.remote);
    if (dateBounds.from) out = out.filter((l) => l.capturedAt >= dateBounds.from!);
    if (dateBounds.to) out = out.filter((l) => l.capturedAt <= dateBounds.to!);
    out.sort((a, b) =>
      sort === "newest"
        ? b.capturedAt.localeCompare(a.capturedAt)
        : a.capturedAt.localeCompare(b.capturedAt),
    );
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, statusFilter, locationFilter, dateBounds, sort, overrides]);

  // Reset to the first page whenever the result set changes.
  useEffect(() => {
    setPage(1);
  }, [statusFilter, locationFilter, dateBounds, sort]);

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
      <div className="space-y-2">
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
            label="Captured"
            value={dateRange}
            onValueChange={(v) => setDateRange(v as DateRange)}
            options={[
              { value: "all", label: "Any time" },
              { value: "7d", label: "Last 7 days" },
              { value: "30d", label: "Last 30 days" },
              { value: "90d", label: "Last 90 days" },
              { value: "custom", label: "Custom range…" },
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

        {dateRange === "custom" && (
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-xs sm:flex-row sm:items-end">
            <DateField
              label="From"
              value={customFrom}
              max={customTo || undefined}
              onChange={setCustomFrom}
            />
            <DateField
              label="To"
              value={customTo}
              min={customFrom || undefined}
              onChange={setCustomTo}
            />
            {(customFrom || customTo) && (
              <button
                type="button"
                onClick={() => {
                  setCustomFrom("");
                  setCustomTo("");
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-xs font-medium text-muted-foreground hover:text-foreground sm:min-h-9"
              >
                Clear dates
              </button>
            )}
          </div>
        )}
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
                  resumeId={resumeIdFor(lead.id)}
                  onResumeChange={(rid) => setResumeFor(lead.id, rid)}
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
      <Select
        items={Object.fromEntries(options.map((o) => [o.value, o.label]))}
        value={value}
        onValueChange={(v) => onValueChange(v ?? value)}
      >
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
  resumeId,
  onResumeChange,
  onOpen,
  onStatusChange,
}: {
  lead: JobLead;
  status: LeadStatus;
  resumeId: string;
  onResumeChange: (resumeId: string) => void;
  onOpen: () => void;
  onStatusChange: (status: LeadStatus) => void;
}) {
  const { openDialog, dialogs } = useLeadActionDialogs(lead, mockResumes, {
    selectedResumeId: resumeId,
    onResumeChange,
  });

  const fit = computeFitScore(lead.id, resumeId);
  const band = fitBand(fit);
  const resumeLabel =
    mockResumes.find((r) => r.id === resumeId)?.label ?? "resume";
  const hasContacts = lead.contactCount > 0;

  // Stop card-body clicks/keys from firing on the header & footer controls.
  const stop = {
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation(),
  };

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
      className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border bg-card shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {/* HEADER — current state + jump out to the source listing */}
      <div
        {...stop}
        className="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-1.5"
      >
        <StatusControl status={status} onChange={onStatusChange} />
        <a
          href={lead.canonicalJobUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open on LinkedIn"
          title="Open on LinkedIn"
          className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:size-9"
        >
          <ExternalLink className="size-4" aria-hidden />
        </a>
      </div>

      {/* BODY — clicking anywhere here opens the detail modal */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-sm leading-snug font-medium group-hover:text-primary">
          {lead.title}
        </h3>
        <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          {lead.company} · {lead.location}
        </p>
        {/* Fit score vs the default (or chosen) resume */}
        <div
          className="mt-2.5 flex items-center gap-2"
          title={`Fit for ${resumeLabel}`}
        >
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums",
              band.chip,
            )}
          >
            <Gauge className="size-3" aria-hidden />
            {fit}
          </span>
          <span className="min-w-0 truncate text-[11px] text-muted-foreground">
            {band.label} · {resumeLabel}
          </span>
        </div>
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

      {/* FOOTER — create actions for this lead */}
      <div {...stop} className="grid grid-cols-3 divide-x border-t">
        <CardActionButton
          icon={UserPlus}
          label="Contact"
          onClick={() => openDialog("contact")}
        />
        <CardActionButton
          icon={BellPlus}
          label="Reminder"
          onClick={() => openDialog("reminder")}
        />
        <CardActionButton
          icon={Send}
          label="Draft"
          onClick={() => openDialog("outreach")}
          disabled={!hasContacts}
          title={
            hasContacts ? "Draft outreach" : "Add a contact first to draft outreach"
          }
        />
      </div>

      {dialogs}
    </div>
  );
}

/** Clickable status pill in the card header that changes the lead's status. */
function StatusControl({
  status,
  onChange,
}: {
  status: LeadStatus;
  onChange: (status: LeadStatus) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Change status"
        title="Change status"
        className="inline-flex min-h-11 items-center gap-1 rounded-full pr-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:min-h-8"
      >
        <StatusBadge status={status} />
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Change status</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={status}
          onValueChange={(v) => onChange(v as LeadStatus)}
        >
          {LEAD_STATUSES.map((s) => (
            <DropdownMenuRadioItem key={s} value={s}>
              {LEAD_STATUS_LABELS[s]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Footer action button: icon + short label, full-height touch target. */
function CardActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  title,
}: {
  icon: typeof UserPlus;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex min-h-11 items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 sm:min-h-10"
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
    </button>
  );
}
