"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Clock3, FileText, Hourglass, PlayCircle, RotateCcw, Search, Trophy, UserRound, type LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  RowActions,
  TableBox,
  TablePagination,
  tableSelectCls,
  usePagination,
} from "@/components/ui/data-table";
import { LevelTag, ScoreRing, SourceTag, Sparkline, bandTone } from "@/components/mock-interviews/visual-kit";
import type { InterviewStatus, InterviewSummary } from "@/lib/mock-interviews/model";
import { scoreBand, shortDate } from "@/lib/mock-interviews/model";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

// Interview history (spec D49, D53): every AI and human interview, newest first,
// with its score and report. Records can't be deleted (owner, November 17,
// 2026), so there's no multi-select: nothing to do in bulk.

const STATUS_TEXT: Record<InterviewStatus, string> = {
  completed: "Report ready",
  awaiting_report: "Waiting for evaluation",
  interrupted: "Stopped early",
  in_progress: "In progress",
  failed: "Couldn't finish",
};
const STATUS_TONE: Record<InterviewStatus, string> = {
  completed: "bg-emerald-50 text-emerald-800",
  awaiting_report: "bg-amber-50 text-amber-800",
  interrupted: "bg-slate-100 text-slate-700",
  in_progress: "bg-sky-50 text-sky-800",
  failed: "bg-rose-50 text-rose-800",
};

type TypeFilter = "all" | "ai" | "human";
// Each report keeps the overall score its weights gave (weights can change later).
const scoreOf = (i: InterviewSummary) => (i.scores ? (i.overall ?? null) : null);

export function HistoryTable({ interviews }: { interviews: InterviewSummary[] }) {
  const mounted = useMounted();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [status, setStatus] = useState<"all" | InterviewStatus>("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return interviews.filter(
      (i) =>
        (type === "all" || i.source === type) &&
        (status === "all" || i.status === status) &&
        (!q || `${i.role} ${i.category} ${i.industry} ${i.interviewer ?? ""}`.toLowerCase().includes(q)),
    );
  }, [interviews, query, type, status]);

  const paging = usePagination(rows, `${query}|${type}|${status}`);

  const scored = [...interviews].filter((i) => i.scores).sort((a, b) => a.date.localeCompare(b.date));
  const recent = scored.slice(-6);
  const scores = scored.map((i) => scoreOf(i)!);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const best = scores.length ? Math.max(...scores) : 0;
  const counts = {
    ai: interviews.filter((i) => i.source === "ai").length,
    human: interviews.filter((i) => i.source === "human").length,
    waiting: interviews.filter((i) => i.status === "awaiting_report").length,
    ready: interviews.filter((i) => i.status === "completed").length,
  };


  return (
    <div className="mx-auto max-w-6xl space-y-4">

      {/* Hero: your record at a glance */}
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-4 bg-gradient-to-r from-primary/12 via-violet-500/8 to-transparent p-4 md:flex-row md:items-center md:p-5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-600 text-white shadow-sm">
              <Clock3 className="size-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight">Interview history</h1>
              <p className="text-sm text-muted-foreground">Every interview you&apos;ve done, with its score and report.</p>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-2 rounded-xl border bg-white/70 p-2 text-center md:w-[26rem]">
            <div className="px-1">
              <dt className="text-[11px] text-muted-foreground">Average</dt>
              <dd className={cn("text-xl font-semibold tabular-nums", bandTone(avg).text)}>{avg}</dd>
            </div>
            <div className="px-1">
              <dt className="text-[11px] text-muted-foreground">Best</dt>
              <dd className="inline-flex items-center gap-1 text-xl font-semibold tabular-nums">
                <Trophy className="size-4 text-amber-500" aria-hidden />
                {best}
              </dd>
            </div>
            <div className="flex flex-col items-center px-1">
              <dt className="text-[11px] text-muted-foreground">Recent trend</dt>
              <dd>
                <Sparkline values={recent.map((i) => scoreOf(i)!)} labels={mounted ? recent.map((i) => shortDate(i.date)) : []} className="h-7 w-24" />
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Stat tiles: each filters the list; click again to clear. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Bot} tone="indigo" label="AI interviews" value={counts.ai} active={type === "ai"} onClick={() => setType(type === "ai" ? "all" : "ai")} />
        <Tile icon={UserRound} tone="orange" label="With an interviewer" value={counts.human} active={type === "human"} onClick={() => setType(type === "human" ? "all" : "human")} />
        <Tile
          icon={FileText}
          tone="emerald"
          label="Reports ready"
          value={counts.ready}
          active={status === "completed"}
          onClick={() => setStatus(status === "completed" ? "all" : "completed")}
        />
        <Tile
          icon={Hourglass}
          tone="amber"
          label="Waiting for evaluation"
          value={counts.waiting}
          active={status === "awaiting_report"}
          onClick={() => setStatus(status === "awaiting_report" ? "all" : "awaiting_report")}
        />
      </div>

      <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm md:p-5">
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
          <select aria-label="Status" className={cn(tableSelectCls, "h-11 sm:h-9")} value={status} onChange={(e) => setStatus(e.target.value as "all" | InterviewStatus)}>
            <option value="all">All statuses</option>
            {(Object.keys(STATUS_TEXT) as InterviewStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_TEXT[s]}
              </option>
            ))}
          </select>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <Clock3 className="mx-auto size-9 text-primary/60" aria-hidden />
            <p className="mt-2 font-medium">{interviews.length === 0 ? "No interviews yet" : "No interviews match these filters"}</p>
            {interviews.length === 0 && (
              <Link href="/mock-interviews/ai" className={cn(buttonVariants({ size: "lg" }), "mt-4")}>
                Book your first interview
              </Link>
            )}
          </div>
        ) : (
          <TableBox minWidth={980}>
            <thead className="border-b bg-white/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="w-36 px-3 py-2 font-medium">Report</th>
                <th className="px-3 py-2 font-medium">Score</th>
                <th className="min-w-56 px-3 py-2 font-medium">Interview</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Level</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="w-14 px-3 py-2 text-right font-medium">More</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paging.paged.map((i) => (
                <HistoryRow
                  key={i.id}
                  i={i}
                  mounted={mounted}
                  onOpen={(href) => router.push(href)}
                />
              ))}
            </tbody>
          </TableBox>
        )}
        <TablePagination paging={paging} />
      </section>
    </div>
  );
}

const TILE_TONE = {
  indigo: { icon: "bg-primary/10 text-primary", ring: "border-primary ring-2 ring-primary/20" },
  orange: { icon: "bg-orange-100 text-orange-700", ring: "border-orange-400 ring-2 ring-orange-200" },
  emerald: { icon: "bg-emerald-100 text-emerald-700", ring: "border-emerald-400 ring-2 ring-emerald-200" },
  amber: { icon: "bg-amber-100 text-amber-700", ring: "border-amber-400 ring-2 ring-amber-200" },
} as const;

function Tile({
  icon: Icon,
  tone,
  label,
  value,
  active,
  onClick,
}: {
  icon: LucideIcon;
  tone: keyof typeof TILE_TONE;
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  const t = TILE_TONE[tone];
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-h-16 items-center gap-3 rounded-2xl border bg-card p-3 text-left shadow-sm transition-all hover:-translate-y-px hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:hover:translate-y-0",
        active && t.ring,
      )}
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", t.icon)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl leading-none font-semibold tabular-nums">{value}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{label}</span>
      </span>
    </button>
  );
}

function HistoryRow({
  i,
  mounted,
  onOpen,
}: {
  i: InterviewSummary;
  mounted: boolean;
  onOpen: (href: string) => void;
}) {
  const overall = scoreOf(i);
  const report = `/mock-interviews/report/${i.id}`;
  return (
    <tr className="align-middle">
      <td className="px-3 py-2">
        {i.status === "completed" ? (
          <Link href={report} className={cn(buttonVariants({ variant: "outline" }), "w-full border-emerald-300 text-emerald-800 hover:bg-emerald-50")}>
            <FileText className="size-4" aria-hidden />
            View report
          </Link>
        ) : i.status === "awaiting_report" ? (
          <Link href={report} className={cn(buttonVariants({ variant: "outline" }), "w-full border-amber-300 text-amber-800 hover:bg-amber-50")}>
            <Hourglass className="size-4" aria-hidden />
            Waiting
          </Link>
        ) : i.status === "failed" ? (
          <span className="block text-center text-xs text-muted-foreground">Couldn&apos;t finish</span>
        ) : (
          <Link href={`/mock-interviews/ai/prepare/${i.id}`} className={cn(buttonVariants(), "w-full bg-amber-500 text-white hover:bg-amber-600")}>
            <PlayCircle className="size-4" aria-hidden />
            Resume
          </Link>
        )}
      </td>
      <td className="px-3 py-2">
        {overall === null ? (
          <span className="text-xs text-muted-foreground">No score yet</span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <ScoreRing value={overall} size={38} />
            <span className={cn("text-xs font-semibold", bandTone(overall).text)}>{scoreBand(overall)}</span>
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <p className="font-medium">{i.role}</p>
        <p className="text-xs text-muted-foreground">
          {i.category} · {i.industry}
        </p>
      </td>
      <td className="px-3 py-2">
        <SourceTag source={i.source} name={i.interviewer} />
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <LevelTag level={i.difficulty} />
        <span className="ml-1.5 text-xs text-muted-foreground">{i.durationMin} min</span>
      </td>
      <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">{mounted ? shortDate(i.date) : " "}</td>
      <td className="px-3 py-2">
        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", STATUS_TONE[i.status])}>{STATUS_TEXT[i.status]}</span>
      </td>
      <td className="px-3 py-1 text-right">
        <RowActions label={i.role}>
          {(i.status === "completed" || i.status === "awaiting_report") && (
            <DropdownMenuItem onClick={() => onOpen(report)}>
              <FileText className="size-4" aria-hidden />
              {i.status === "completed" ? "View report" : "View details"}
            </DropdownMenuItem>
          )}
          {i.source === "ai" && (
            <DropdownMenuItem onClick={() => onOpen("/mock-interviews/ai/new")}>
              <RotateCcw className="size-4" aria-hidden />
              Book a similar one
            </DropdownMenuItem>
          )}
        </RowActions>
      </td>
    </tr>
  );
}
