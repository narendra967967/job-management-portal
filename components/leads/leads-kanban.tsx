"use client";

// Kanban board for the Leads page (laptop). Columns are lead statuses you pick;
// dragging a card to another column changes its status (drag to Closed asks for
// an outcome). Uses @dnd-kit. Mobile keeps the list view for now.

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  MapPin,
  Gauge,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowDownUp,
} from "lucide-react";
import {
  CLOSE_OUTCOME_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  fitScoreKey,
  isJobOpen,
  type CloseOutcome,
  type FitScore,
  type JobLead,
  type LeadStatus,
} from "@/lib/types";
import {
  useLeads,
  useResumes,
  useDefaultResumeId,
  useAppSettings,
  useFitScore,
  useAllFitScores,
  setLeadStatus,
} from "@/lib/mock-store";
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
import { useSearchQuery } from "@/lib/search-store";
import { fitBand } from "@/lib/fit";
import { StatusBadge } from "@/components/leads/status-badge";
import { LeadDetailDialog } from "@/components/leads/lead-detail-dialog";
import {
  LeadFilters,
  applyLeadFilters,
  EMPTY_LEAD_FILTERS,
  type LeadFilterValue,
} from "@/components/leads/lead-filters";
import { usePersistentState, PERSIST_KEYS } from "@/lib/use-persistent-state";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COL_ACCENT: Record<LeadStatus, string> = {
  new: "bg-status-new-foreground",
  reviewing: "bg-status-reviewing-foreground",
  applied: "bg-status-applied-foreground",
  discarded: "bg-status-discarded-foreground",
  closed: "bg-status-closed-foreground",
};

// Colour-coded, prominent count pill per column.
const COL_COUNT: Record<LeadStatus, string> = {
  new: "bg-status-new text-status-new-foreground",
  reviewing: "bg-status-reviewing text-status-reviewing-foreground",
  applied: "bg-status-applied text-status-applied-foreground",
  discarded: "bg-status-discarded text-status-discarded-foreground",
  closed: "bg-status-closed text-status-closed-foreground",
};

const DEFAULT_COLUMNS: LeadStatus[] = ["new", "reviewing", "applied"];

// Per-column card sorting.
type SortKey =
  | "added-desc"
  | "added-asc"
  | "score-desc"
  | "score-asc"
  | "company-asc"
  | "title-asc";

const DEFAULT_SORT: SortKey = "added-desc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "added-desc", label: "Newest added" },
  { value: "added-asc", label: "Oldest added" },
  { value: "score-desc", label: "Score: high → low" },
  { value: "score-asc", label: "Score: low → high" },
  { value: "company-asc", label: "Company A–Z" },
  { value: "title-asc", label: "Title A–Z" },
];

/**
 * Sort a column's cards. Unscored ("NC") cards always sink to the bottom on a
 * score sort so the ranked, scored cards stay at the top.
 */
function sortLeads(
  leads: JobLead[],
  sort: SortKey,
  scores: Record<string, FitScore>,
  resumeId: string,
): JobLead[] {
  const arr = [...leads];
  const scoreOf = (l: JobLead) => scores[fitScoreKey(l.id, resumeId)]?.score;
  switch (sort) {
    case "added-asc":
      arr.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
      break;
    case "company-asc":
      arr.sort(
        (a, b) =>
          a.company.localeCompare(b.company) || a.title.localeCompare(b.title),
      );
      break;
    case "title-asc":
      arr.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "score-desc":
    case "score-asc": {
      const dir = sort === "score-desc" ? -1 : 1;
      arr.sort((a, b) => {
        const sa = scoreOf(a);
        const sb = scoreOf(b);
        if (sa === undefined && sb === undefined)
          return b.capturedAt.localeCompare(a.capturedAt);
        if (sa === undefined) return 1; // NC last
        if (sb === undefined) return -1;
        return (sa - sb) * dir;
      });
      break;
    }
    case "added-desc":
    default:
      arr.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  }
  return arr;
}

/** Local YYYY-MM-DD for the stale check. */
function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function LeadsKanban() {
  const allLeads = useLeads();
  const resumes = useResumes();
  const [defaultResumeId] = useDefaultResumeId();
  const [{ staleLeadDays }] = useAppSettings();
  const search = useSearchQuery();
  const { confirm, dialog: confirmDialog } = useConfirm();

  // Columns persist across reload AND logout/login (localStorage); filters
  // persist across reload but reset on logout (sessionStorage).
  const [columns, setColumns] = usePersistentState<LeadStatus[]>(
    PERSIST_KEYS.kanbanColumns,
    DEFAULT_COLUMNS,
  );
  const [filters, setFilters] = usePersistentState<LeadFilterValue>(
    PERSIST_KEYS.leadsFilters,
    EMPTY_LEAD_FILTERS,
    "session",
  );
  // Per-column sort (persists across reload/login).
  const [sorts, setSorts] = usePersistentState<Partial<Record<LeadStatus, SortKey>>>(
    PERSIST_KEYS.kanbanSort,
    {},
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detailLead, setDetailLead] = useState<JobLead | null>(null);
  // Lead awaiting a close outcome (dragged onto the Closed column).
  const [closingLead, setClosingLead] = useState<JobLead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const staleCutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - staleLeadDays);
    return toISODate(d);
  }, [staleLeadDays]);

  const filtered = useMemo(() => {
    let out = applyLeadFilters(allLeads, filters);
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.company.toLowerCase().includes(q) ||
          l.location.toLowerCase().includes(q) ||
          l.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return out;
  }, [allLeads, filters, search]);

  const byStatus = useMemo(() => {
    const map: Record<LeadStatus, JobLead[]> = {
      new: [],
      reviewing: [],
      applied: [],
      discarded: [],
      closed: [],
    };
    for (const l of filtered) map[l.status].push(l);
    // Ordering is applied per-column (by each column's chosen sort).
    return map;
  }, [filtered]);

  const activeLead = activeId
    ? (allLeads.find((l) => l.id === activeId) ?? null)
    : null;

  function toggleColumn(s: LeadStatus) {
    setColumns((prev) =>
      prev.includes(s) ? prev.filter((c) => c !== s) : [...prev, s],
    );
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const lead = allLeads.find((l) => l.id === String(active.id));
    const target = String(over.id) as LeadStatus;
    if (!lead || lead.status === target) return;
    if (target === "closed") {
      setClosingLead(lead); // ask for an outcome before closing
      return;
    }
    if (target === "discarded") {
      const ok = await confirm({
        title: "Discard this lead?",
        description: `"${lead.title}" moves to Archive and any pending follow-ups are cancelled. You can reopen it later.`,
        confirmLabel: "Discard",
        destructive: true,
      });
      if (!ok) return;
    }
    setLeadStatus(lead.id, target);
  }

  // Columns shown, in canonical pipeline order.
  const shown = LEAD_STATUSES.filter((s) => columns.includes(s));

  return (
    <div className="space-y-3">
      {confirmDialog}
      {/* Filters (everything but status — status is the columns) */}
      <LeadFilters leads={allLeads} value={filters} onChange={setFilters} />

      {/* Column picker */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Columns:</span>
        {LEAD_STATUSES.map((s) => {
          const on = columns.includes(s);
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              onClick={() => toggleColumn(s)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                on
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              <span className={cn("size-2 rounded-full", COL_ACCENT[s])} aria-hidden />
              {LEAD_STATUS_LABELS[s]}
            </button>
          );
        })}
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex h-[calc(100dvh-15rem)] min-h-[24rem] gap-3 overflow-x-auto pb-2">
          {shown.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
              Pick at least one column above.
            </div>
          ) : (
            shown.map((s) => (
              <Column
                key={s}
                status={s}
                leads={byStatus[s]}
                staleCutoff={staleCutoff}
                resumeId={defaultResumeId}
                sort={sorts[s] ?? DEFAULT_SORT}
                onSortChange={(k) => setSorts((prev) => ({ ...prev, [s]: k }))}
                onOpen={setDetailLead}
              />
            ))
          )}
        </div>

        <DragOverlay>
          {activeLead ? (
            <KanbanCard
              lead={activeLead}
              staleCutoff={staleCutoff}
              resumeId={defaultResumeId}
              overlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <LeadDetailDialog
        lead={detailLead}
        resumes={resumes}
        resumeId={detailLead ? defaultResumeId : undefined}
        open={detailLead !== null}
        onOpenChange={(o) => !o && setDetailLead(null)}
      />

      {/* Close-outcome prompt when a card is dropped on the Closed column */}
      <Dialog
        open={closingLead !== null}
        onOpenChange={(o) => !o && setClosingLead(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Close this job</DialogTitle>
            <DialogDescription>
              {closingLead
                ? `${closingLead.company} · ${closingLead.title}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 py-1">
            {(Object.keys(CLOSE_OUTCOME_LABELS) as CloseOutcome[]).map((o) => (
              <Button
                key={o}
                variant="outline"
                onClick={() => {
                  if (closingLead) setLeadStatus(closingLead.id, "closed", o);
                  setClosingLead(null);
                }}
              >
                {CLOSE_OUTCOME_LABELS[o]}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClosingLead(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Column({
  status,
  leads,
  staleCutoff,
  resumeId,
  sort,
  onSortChange,
  onOpen,
}: {
  status: LeadStatus;
  leads: JobLead[];
  staleCutoff: string;
  resumeId: string;
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  onOpen: (lead: JobLead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const scores = useAllFitScores();
  const sortedLeads = useMemo(
    () => sortLeads(leads, sort, scores, resumeId),
    [leads, sort, scores, resumeId],
  );
  const sortLabel =
    SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Sort";
  const sorted = sort !== DEFAULT_SORT;

  return (
    <div className="flex h-full w-72 shrink-0 flex-col rounded-xl border bg-muted/30">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("size-2.5 rounded-full", COL_ACCENT[status])} aria-hidden />
          <span className="truncate text-sm font-semibold">
            {LEAD_STATUS_LABELS[status]}
          </span>
          <span
            className={cn(
              "inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
              COL_COUNT[status],
            )}
          >
            {leads.length}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Sort ${LEAD_STATUS_LABELS[status]} · ${sortLabel}`}
            title={`Sort: ${sortLabel}`}
            className={cn(
              "relative flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              sorted && "text-primary",
            )}
          >
            <ArrowDownUp className="size-4" aria-hidden />
            {sorted && (
              <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Sort cards</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={sort}
              onValueChange={(v) => onSortChange(v as SortKey)}
            >
              {SORT_OPTIONS.map((o) => (
                <DropdownMenuRadioItem key={o.value} value={o.value}>
                  {o.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 overflow-y-auto p-2 transition-colors",
          isOver && "bg-primary/5 ring-2 ring-inset ring-primary/30",
        )}
      >
        {sortedLeads.map((lead) => (
          <DraggableCard
            key={lead.id}
            lead={lead}
            staleCutoff={staleCutoff}
            resumeId={resumeId}
            onOpen={onOpen}
          />
        ))}
        {leads.length === 0 && (
          <p className="rounded-lg border border-dashed p-4 text-center text-[11px] text-muted-foreground">
            Drop a lead here
          </p>
        )}
      </div>
    </div>
  );
}

function DraggableCard({
  lead,
  staleCutoff,
  resumeId,
  onOpen,
}: {
  lead: JobLead;
  staleCutoff: string;
  resumeId: string;
  onOpen: (lead: JobLead) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(lead)}
      className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-40")}
    >
      <KanbanCard lead={lead} staleCutoff={staleCutoff} resumeId={resumeId} />
    </div>
  );
}

function KanbanCard({
  lead,
  staleCutoff,
  resumeId,
  overlay,
}: {
  lead: JobLead;
  staleCutoff: string;
  resumeId: string;
  overlay?: boolean;
}) {
  const cached = useFitScore(lead.id, resumeId);
  const band = cached ? fitBand(cached.score) : null;
  const open = isJobOpen(lead.status);
  const ready = open && lead.hasJd && lead.contactCount > 0 && !lead.hasOutreach;
  const stale =
    open && !lead.hasDueReminder && lead.capturedAt < staleCutoff;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 shadow-xs",
        overlay ? "w-72 rotate-2 shadow-lg" : "hover:border-primary/40",
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <StatusBadge status={lead.status} />
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
            cached && band ? band.chip : "bg-muted text-muted-foreground",
          )}
        >
          <Gauge className="size-2.5" aria-hidden />
          {cached ? cached.score : "NC"}
        </span>
      </div>
      <p className="line-clamp-2 text-sm font-medium leading-snug">{lead.title}</p>
      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="size-3 shrink-0" aria-hidden />
        <span className="truncate">
          {lead.company} · {lead.location}
        </span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {ready && (
          <Badge className="bg-status-applied text-status-applied-foreground">
            <CheckCircle2 className="size-2.5" aria-hidden />
            Ready
          </Badge>
        )}
        {lead.hasDueReminder && (
          <Badge className="bg-status-reviewing text-status-reviewing-foreground">
            <Clock className="size-2.5" aria-hidden />
            Due
          </Badge>
        )}
        {stale && (
          <Badge className="border border-destructive/40 text-destructive">
            <AlertTriangle className="size-2.5" aria-hidden />
            Stale
          </Badge>
        )}
        {lead.contactCount > 0 && (
          <Badge className="bg-muted text-muted-foreground">
            <Users className="size-2.5" aria-hidden />
            {lead.contactCount}
          </Badge>
        )}
      </div>
    </div>
  );
}

function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}
