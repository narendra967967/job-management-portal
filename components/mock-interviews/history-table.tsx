"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, PlayCircle, RotateCcw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import {
  BulkBar,
  RowActions,
  RowCheckbox,
  SelectAllCheckbox,
  StatBox,
  TableBox,
  TablePagination,
  tableSelectCls,
  usePagination,
  useRowSelection,
} from "@/components/ui/data-table";
import { SampleBanner } from "@/components/mock-interviews/sample-banner";
import { SAMPLE_INTERVIEWS, SAMPLE_SETTINGS, type SampleInterview, type SessionStatus } from "@/lib/mock-interviews/sample-data";
import { overallScore, shortDate } from "@/lib/mock-interviews/model";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

// Interview history (spec D49, D53): every AI and human interview, newest first.
// R1.2: sample data.

const STATUS_TEXT: Record<SessionStatus, string> = {
  completed: "Report ready",
  awaiting_report: "Waiting for evaluation",
  interrupted: "Stopped early",
  in_progress: "In progress",
};
const STATUS_TONE: Record<SessionStatus, string> = {
  completed: "bg-emerald-50 text-emerald-800",
  awaiting_report: "bg-amber-50 text-amber-800",
  interrupted: "bg-slate-100 text-slate-700",
  in_progress: "bg-sky-50 text-sky-800",
};

type TypeFilter = "all" | "ai" | "human";

export function HistoryTable() {
  const mounted = useMounted();
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [status, setStatus] = useState<"all" | SessionStatus>("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SAMPLE_INTERVIEWS.filter(
      (i) =>
        (type === "all" || i.source === type) &&
        (status === "all" || i.status === status) &&
        (!q || `${i.role} ${i.category} ${i.industry} ${i.interviewer ?? ""}`.toLowerCase().includes(q)),
    );
  }, [query, type, status]);

  const paging = usePagination(rows, `${query}|${type}|${status}`);
  const selection = useRowSelection(rows.map((r) => r.id));
  const counts = {
    ai: SAMPLE_INTERVIEWS.filter((i) => i.source === "ai").length,
    human: SAMPLE_INTERVIEWS.filter((i) => i.source === "human").length,
    waiting: SAMPLE_INTERVIEWS.filter((i) => i.status === "awaiting_report").length,
  };

  async function remove(ids: string[]) {
    const ok = await confirm({
      title: ids.length === 1 ? "Delete this interview?" : `Delete ${ids.length} interviews?`,
      description: "Their reports and scores are removed from your history and Performance. This can't be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    selection.clear();
    toast.info("Sample: nothing was deleted", "Deleting works once interviews are saved.");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <SampleBanner />
      <h1 className="text-lg font-semibold tracking-tight">Interview history</h1>

      <div className="grid grid-cols-3 gap-2 sm:max-w-xl">
        <StatBox label="AI interviews" value={String(counts.ai)} active={type === "ai"} onClick={() => setType(type === "ai" ? "all" : "ai")} />
        <StatBox label="With an interviewer" value={String(counts.human)} active={type === "human"} onClick={() => setType(type === "human" ? "all" : "human")} />
        <StatBox
          label="Waiting for evaluation"
          value={String(counts.waiting)}
          active={status === "awaiting_report"}
          onClick={() => setStatus(status === "awaiting_report" ? "all" : "awaiting_report")}
        />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="relative min-w-0 flex-1 basis-56">
          <span className="sr-only">Search interviews</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search role, kind or interviewer" className="h-11 pl-9 sm:h-9" />
        </label>
        <select aria-label="Type" className={cn(tableSelectCls, "h-11 sm:h-9")} value={type} onChange={(e) => setType(e.target.value as TypeFilter)}>
          <option value="all">All types</option>
          <option value="ai">AI</option>
          <option value="human">With an interviewer</option>
        </select>
        <select aria-label="Status" className={cn(tableSelectCls, "h-11 sm:h-9")} value={status} onChange={(e) => setStatus(e.target.value as "all" | SessionStatus)}>
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_TEXT) as SessionStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_TEXT[s]}
            </option>
          ))}
        </select>
      </div>

      <BulkBar selection={selection}>
        <Button variant="destructive" onClick={() => void remove([...selection.selected])}>
          <Trash2 className="size-4" aria-hidden />
          Delete
        </Button>
      </BulkBar>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          {SAMPLE_INTERVIEWS.length === 0 ? "No interviews yet. Your first one will show up here." : "No interviews match these filters."}
        </p>
      ) : (
        <TableBox minWidth={880}>
          <thead className="border-b bg-white/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2">
                <SelectAllCheckbox selection={selection} />
              </th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="min-w-56 px-3 py-2 font-medium">Interview</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Length</th>
              <th className="px-3 py-2 text-right font-medium">Score</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="w-14 px-3 py-2 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {paging.paged.map((i) => (
              <HistoryRow
                key={i.id}
                i={i}
                mounted={mounted}
                selection={selection}
                onOpen={(href) => router.push(href)}
                onDelete={() => void remove([i.id])}
              />
            ))}
          </tbody>
        </TableBox>
      )}
      <TablePagination paging={paging} />
      {dialog}
    </div>
  );
}

function HistoryRow({
  i,
  mounted,
  selection,
  onOpen,
  onDelete,
}: {
  i: SampleInterview;
  mounted: boolean;
  selection: ReturnType<typeof useRowSelection>;
  onOpen: (href: string) => void;
  onDelete: () => void;
}) {
  const overall = i.scores ? overallScore(i.scores, SAMPLE_SETTINGS.weights) : null;
  const report = `/mock-interviews/report/${i.id}`;
  return (
    <tr className="align-middle">
      <td className="px-3 py-2">
        <RowCheckbox selection={selection} id={i.id} label={`${i.role} on ${i.date.slice(0, 10)}`} />
      </td>
      <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">{mounted ? shortDate(i.date) : " "}</td>
      <td className="px-3 py-2">
        {i.status === "completed" || i.status === "awaiting_report" ? (
          <Link href={report} className="font-medium hover:text-primary hover:underline">
            {i.role}
          </Link>
        ) : (
          <span className="font-medium">{i.role}</span>
        )}
        <p className="text-xs text-muted-foreground">
          {i.category} · {i.difficulty}
        </p>
      </td>
      <td className="px-3 py-2 text-xs whitespace-nowrap">{i.source === "ai" ? "AI" : `Interviewer · ${i.interviewer}`}</td>
      <td className="px-3 py-2 text-xs whitespace-nowrap">{i.durationMin} min</td>
      <td className="px-3 py-2 text-right tabular-nums">{overall === null ? <span className="text-muted-foreground">-</span> : <span className="font-medium">{overall}</span>}</td>
      <td className="px-3 py-2">
        <span className={cn("inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap", STATUS_TONE[i.status])}>{STATUS_TEXT[i.status]}</span>
      </td>
      <td className="px-3 py-1 text-right">
        <RowActions label={i.role}>
          {(i.status === "completed" || i.status === "awaiting_report") && (
            <DropdownMenuItem onClick={() => onOpen(report)}>
              <FileText className="size-4" aria-hidden />
              {i.status === "completed" ? "View report" : "View details"}
            </DropdownMenuItem>
          )}
          {i.status === "interrupted" && (
            <DropdownMenuItem onClick={() => onOpen(`/mock-interviews/ai/session/${i.id}`)}>
              <PlayCircle className="size-4" aria-hidden />
              Resume
            </DropdownMenuItem>
          )}
          {i.source === "ai" && (
            <DropdownMenuItem onClick={() => onOpen("/mock-interviews/ai/new")}>
              <RotateCcw className="size-4" aria-hidden />
              Practice again
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="size-4" aria-hidden />
            Delete
          </DropdownMenuItem>
        </RowActions>
      </td>
    </tr>
  );
}
