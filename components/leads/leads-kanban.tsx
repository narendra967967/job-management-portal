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
} from "lucide-react";
import {
  CLOSE_OUTCOME_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  isJobOpen,
  type CloseOutcome,
  type JobLead,
  type LeadStatus,
} from "@/lib/types";
import {
  useLeads,
  useResumes,
  useDefaultResumeId,
  useAppSettings,
  setLeadStatus,
} from "@/lib/mock-store";
import { useSearchQuery } from "@/lib/search-store";
import { computeFitScore, fitBand } from "@/lib/fit";
import { StatusBadge } from "@/components/leads/status-badge";
import { LeadDetailDialog } from "@/components/leads/lead-detail-dialog";
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

const DEFAULT_COLUMNS: LeadStatus[] = ["new", "reviewing", "applied"];

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

  const [columns, setColumns] = useState<LeadStatus[]>(DEFAULT_COLUMNS);
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
    const q = search.trim().toLowerCase();
    if (!q) return allLeads;
    return allLeads.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.location.toLowerCase().includes(q) ||
        l.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [allLeads, search]);

  const byStatus = useMemo(() => {
    const map: Record<LeadStatus, JobLead[]> = {
      new: [],
      reviewing: [],
      applied: [],
      discarded: [],
      closed: [],
    };
    for (const l of filtered) map[l.status].push(l);
    // Newest first within each column.
    for (const s of LEAD_STATUSES)
      map[s].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
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

  function onDragEnd(e: DragEndEvent) {
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
    setLeadStatus(lead.id, target);
  }

  // Columns shown, in canonical pipeline order.
  const shown = LEAD_STATUSES.filter((s) => columns.includes(s));

  return (
    <div className="space-y-3">
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
  onOpen,
}: {
  status: LeadStatus;
  leads: JobLead[];
  staleCutoff: string;
  resumeId: string;
  onOpen: (lead: JobLead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex h-full w-72 shrink-0 flex-col rounded-xl border bg-muted/30">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", COL_ACCENT[status])} aria-hidden />
          <span className="text-sm font-medium">{LEAD_STATUS_LABELS[status]}</span>
        </div>
        <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">
          {leads.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 overflow-y-auto p-2 transition-colors",
          isOver && "bg-primary/5 ring-2 ring-inset ring-primary/30",
        )}
      >
        {leads.map((lead) => (
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
  const fit = computeFitScore(lead.id, resumeId);
  const band = fitBand(fit);
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
            band.chip,
          )}
        >
          <Gauge className="size-2.5" aria-hidden />
          {fit}
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
