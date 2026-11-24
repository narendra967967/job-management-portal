"use client";

// Practice interviews on the lead side (docs/lead-interview-link/roadmap.md,
// phases 1 and 2): the practice panel on a lead, the chip on lead cards, the
// "Practice interview" menu item, the prompt when a lead moves to Interview and
// "Interviews coming up". All of it reads the workspace's practice slice and
// hides while AI interviews are Coming soon.

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarClock, FileText, Hourglass, MessagesSquare, PlayCircle, Plus } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { TableBox, TablePagination, usePagination } from "@/components/ui/data-table";
import { buttonVariants } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { CtaGlow, ctaClass } from "@/components/mock-interviews/cta";
import { LevelTag, ScoreRing, bandTone } from "@/components/mock-interviews/visual-kit";
import {
  PRACTICE_STATE_LABELS,
  changeWords,
  leadReadiness,
  newPracticeHref,
  practiceHref,
  type LeadPracticeRun,
  type LeadReadiness,
  type PracticeState,
} from "@/lib/lead-practice";
import { scoreBand, shortDate, type Difficulty } from "@/lib/mock-interviews/model";
import { setPracticePromptHost, useLeadPractice, useLeads, usePractice } from "@/lib/mock-store";
import { useLimitedMode } from "@/lib/access-mode";
import { useMounted } from "@/lib/use-mounted";
import { isJobOpen, type JobLead, type LeadStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ---------------- small pieces ---------------- */

/** ↑ 20% / ↓ 5% / = against the previous scored practice. */
export function TrendTag({ r, className }: { r: Pick<LeadReadiness, "changePct" | "previous">; className?: string }) {
  if (r.changePct === null) return null;
  const up = r.changePct > 0;
  const down = r.changePct < 0;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : ArrowRight;
  return (
    <span
      title={changeWords(r)}
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums",
        up ? "text-emerald-700" : down ? "text-rose-700" : "text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {Math.abs(r.changePct)}%<span className="sr-only">, {changeWords(r)}</span>
    </span>
  );
}

/** The chip on lead cards: "Practiced · 72 ↑20%". Nothing until a practice is done. */
export function PracticeChip({ leadId, className }: { leadId: string; className?: string }) {
  const { open } = usePractice();
  const runs = useLeadPractice(leadId);
  if (!open) return null;
  const r = leadReadiness(runs);
  if (r.practiced === 0) return null;
  return (
    <span
      title={r.latest ? `Latest practice score ${r.latest.score}${r.changePct !== null ? `. ${changeWords(r)}` : ""}` : "Practice report on its way"}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        r.latest ? bandTone(r.latest.score).chip : "border-amber-200 bg-amber-50 text-amber-800",
        className,
      )}
    >
      <MessagesSquare className="size-3" aria-hidden />
      Practiced
      {r.latest ? <span className="font-semibold tabular-nums">· {r.latest.score}</span> : <span>· report soon</span>}
      <TrendTag r={r} />
    </span>
  );
}

/** "Practice interview" in a lead's ⋯ menu. */
export function PracticeMenuItem({ leadId }: { leadId: string }) {
  const router = useRouter();
  const { open } = usePractice();
  if (!open) return null;
  return (
    <DropdownMenuItem onClick={() => router.push(newPracticeHref(leadId))}>
      <MessagesSquare className="size-4" aria-hidden />
      Practice interview
    </DropdownMenuItem>
  );
}

const STATE_TONE: Record<PracticeState, string> = {
  booked: "bg-sky-50 text-sky-800",
  in_progress: "bg-sky-50 text-sky-800",
  paused: "bg-amber-50 text-amber-800",
  awaiting_report: "bg-amber-50 text-amber-800",
  completed: "bg-emerald-50 text-emerald-800",
  ended: "bg-slate-100 text-slate-700",
};

function RunAction({ run }: { run: LeadPracticeRun }) {
  const href = practiceHref(run);
  if (run.state === "completed")
    return (
      <Link href={href} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-11 w-full border-emerald-300 text-emerald-800 hover:bg-emerald-50 sm:min-h-8")}>
        <FileText className="size-4" aria-hidden />
        View report
      </Link>
    );
  if (run.state === "awaiting_report")
    return (
      <Link href={href} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-11 w-full border-amber-300 text-amber-800 hover:bg-amber-50 sm:min-h-8")}>
        <Hourglass className="size-4" aria-hidden />
        Waiting
      </Link>
    );
  if (run.state === "booked" || run.state === "in_progress" || run.state === "paused")
    return (
      <Link href={href} className={cn(buttonVariants({ size: "sm" }), "min-h-11 w-full bg-amber-500 text-white hover:bg-amber-600 sm:min-h-8")}>
        <PlayCircle className="size-4" aria-hidden />
        {run.state === "booked" ? "Start" : "Resume"}
      </Link>
    );
  return (
    <Link href={href} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-11 w-full sm:min-h-8")}>
      History
    </Link>
  );
}

/* ---------------- the panel on a lead ---------------- */

/** Practice for this job, and how earlier practices for it went. Every open
 *  stage gets it; at Interview it's highlighted. Closed leads show only their
 *  history, if any. */
export function PracticePanel({ lead, status, className }: { lead: JobLead; status: LeadStatus; className?: string }) {
  const { open } = usePractice();
  const runs = useLeadPractice(lead.id);
  const mounted = useMounted();
  const paging = usePagination(runs, lead.id);
  if (!open) return null;
  const jobOpen = isJobOpen(status);
  if (!jobOpen && runs.length === 0) return null;
  const r = leadReadiness(runs);
  const highlight = status === "interview";

  return (
    <section
      aria-labelledby="practice-title"
      className={cn(
        "@container rounded-xl border p-3 sm:p-4",
        highlight ? "border-primary/30 bg-gradient-to-r from-primary/8 via-violet-500/5 to-transparent" : "bg-muted/20",
        className,
      )}
    >
      {/* Sized by the panel's own width: next to the sidebar a tablet leaves it narrow. */}
      <div className="flex flex-col gap-3 @xl:flex-row @xl:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {r.latest ? (
            <ScoreRing value={r.latest.score} size={44} className="shrink-0" />
          ) : (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MessagesSquare className="size-5" aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <h2 id="practice-title" className="text-sm font-semibold">
              {highlight && !r.latest ? "Interview coming up?" : "Interview practice"}
            </h2>
            {r.latest ? (
              <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                <span>
                  Latest <span className={cn("font-semibold", bandTone(r.latest.score).text)}>{r.latest.score}</span> ·{" "}
                  {scoreBand(r.latest.score)}
                </span>
                <TrendTag r={r} />
                {r.previous !== null && <span>vs {r.previous} before</span>}
                <span>
                  · {r.scored} {r.scored === 1 ? "practice" : "practices"}
                </span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {r.practiced > 0
                  ? "Your report is on its way."
                  : highlight
                    ? "Practice with a mock interview built from this job's description and your resume."
                    : "A mock interview built from this job's description and your resume."}
              </p>
            )}
          </div>
        </div>
        {jobOpen && (
          <div className="flex flex-col gap-2 @md:flex-row @md:items-center @xl:shrink-0">
            {r.open && (
              <Link href={practiceHref(r.open)} className={cn(ctaClass({ tone: "amber", size: "md", full: true }), "@md:flex-1 @xl:w-auto @xl:flex-none")}>
                <PlayCircle className="size-4" aria-hidden />
                {r.open.state === "booked" ? "Start booked practice" : "Resume practice"}
              </Link>
            )}
            {highlight && !r.open ? (
              <CtaGlow className="w-full @xl:w-auto">
                <Link href={newPracticeHref(lead.id)} className={ctaClass({ size: "md", full: true })}>
                  <MessagesSquare className="size-4" aria-hidden />
                  Practice for this job
                </Link>
              </CtaGlow>
            ) : (
              <Link href={newPracticeHref(lead.id)} className={cn(buttonVariants({ variant: "outline" }), "min-h-11 w-full @md:flex-1 @xl:w-auto @xl:flex-none sm:min-h-9")}>
                <Plus className="size-4" aria-hidden />
                {r.practiced > 0 || r.open ? "Practice again" : "Practice for this job"}
              </Link>
            )}
          </div>
        )}
      </div>

      {runs.length > 0 && (
        <div className="mt-3 space-y-2">
          <TableBox minWidth={560}>
            <thead className="border-b bg-white/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="w-32 px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Score</th>
                <th className="px-3 py-2 font-medium">Level</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paging.paged.map((run) => (
                <tr key={run.id} className="align-middle">
                  <td className="px-3 py-2">
                    <RunAction run={run} />
                  </td>
                  <td className="px-3 py-2">
                    {run.score !== null ? (
                      <span className={cn("text-sm font-semibold tabular-nums", bandTone(run.score).text)}>{run.score}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No score</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <LevelTag level={run.difficulty as Difficulty} />
                    <span className="ml-1.5 text-xs text-muted-foreground">{run.durationMin} min</span>
                  </td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">{mounted ? shortDate(run.date) : " "}</td>
                  <td className="px-3 py-2">
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", STATE_TONE[run.state])}>
                      {PRACTICE_STATE_LABELS[run.state]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableBox>
          {runs.length > paging.pageSize && <TablePagination paging={paging} />}
        </div>
      )}
    </section>
  );
}

/* ---------------- prompt on moving to Interview ---------------- */

/** Mounted once in the dashboard layout: when a lead moves to Interview, a
 *  toast asks to practice for it (every time, owner decision). Its close
 *  button is the "not now". */
export function PracticePromptHost() {
  const router = useRouter();
  useEffect(() => {
    setPracticePromptHost((lead) => {
      toast.info("Moved to Interview", `Practice for ${lead.title} at ${lead.company} now?`, {
        label: "Practice now",
        onClick: () => router.push(newPracticeHref(lead.id)),
      });
    });
    return () => setPracticePromptHost(null);
  }, [router]);
  return null;
}

/* ---------------- interviews coming up ---------------- */

function PracticeStatus({ r }: { r: LeadReadiness }) {
  if (r.latest)
    return (
      <span className="inline-flex items-center gap-2">
        <ScoreRing value={r.latest.score} size={34} />
        <span className="flex flex-col">
          <span className={cn("text-xs font-semibold", bandTone(r.latest.score).text)}>{scoreBand(r.latest.score)}</span>
          <TrendTag r={r} />
        </span>
      </span>
    );
  if (r.open) return <span className="text-xs font-medium text-amber-700">{r.open.state === "booked" ? "Practice booked" : "Practice paused"}</span>;
  if (r.practiced > 0) return <span className="text-xs font-medium text-amber-700">Report on its way</span>;
  return <span className="text-xs text-muted-foreground">Not practiced yet</span>;
}

/** Interview-stage leads with where their practice stands. Until leads carry
 *  an interview date, the most recently active comes first. `compact` is the
 *  short version for Ready to action. */
export function InterviewsComingUp({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { open, byLead } = usePractice();
  const leads = useLeads();
  const limited = useLimitedMode();
  const list = leads
    .filter((l) => l.status === "interview")
    .sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
  const paging = usePagination(list, "");
  if (!open || list.length === 0) return null;
  const shown = compact ? list.slice(0, 3) : paging.paged;

  return (
    <section aria-labelledby="coming-up-title" className={cn("space-y-3 rounded-2xl border bg-card p-4 shadow-sm", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarClock className="size-5" aria-hidden />
        </span>
        <h2 id="coming-up-title" className="text-base font-semibold">
          Interviews coming up <span className="text-sm font-normal text-muted-foreground">({list.length})</span>
        </h2>
        {compact && list.length > 3 && (
          <Link href="/mock-interviews/ai" className="ml-auto inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline sm:min-h-0">
            See all
          </Link>
        )}
      </div>
      <TableBox minWidth={420}>
        <thead className="border-b bg-white/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="w-32 px-3 py-2 font-medium">Action</th>
            <th className="min-w-40 px-3 py-2 font-medium">Job</th>
            <th className="px-3 py-2 font-medium">Practice</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {shown.map((l) => {
            const r = leadReadiness(byLead[l.id]);
            return (
              <tr key={l.id} className="align-middle">
                <td className="px-3 py-2">
                  {r.open ? (
                    <Link href={practiceHref(r.open)} className={cn(buttonVariants({ size: "sm" }), "min-h-11 w-full bg-amber-500 text-white hover:bg-amber-600 sm:min-h-8")}>
                      <PlayCircle className="size-4" aria-hidden />
                      {r.open.state === "booked" ? "Start" : "Resume"}
                    </Link>
                  ) : (
                    <Link
                      href={newPracticeHref(l.id)}
                      className={cn(buttonVariants({ variant: r.practiced ? "outline" : "default", size: "sm" }), "min-h-11 w-full sm:min-h-8")}
                    >
                      <MessagesSquare className="size-4" aria-hidden />
                      {r.practiced ? "Practice again" : "Practice"}
                    </Link>
                  )}
                </td>
                <td className="px-3 py-2">
                  {limited ? (
                    <p className="font-medium">{l.title}</p>
                  ) : (
                    <Link href={`/leads/${l.id}`} className="font-medium hover:text-primary hover:underline">
                      {l.title}
                    </Link>
                  )}
                  <p className="text-xs text-muted-foreground">{l.company}</p>
                </td>
                <td className="px-3 py-2">
                  <PracticeStatus r={r} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableBox>
      {!compact && list.length > paging.pageSize && <TablePagination paging={paging} />}
    </section>
  );
}
