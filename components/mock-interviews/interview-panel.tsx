"use client";

import { Brain, CheckCircle2, Circle, Gauge, Lightbulb, MessageCircle, Sparkles, Target, Wrench } from "lucide-react";
import { METRICS, type MetricKey } from "@/lib/mock-interviews/model";
import { cn } from "@/lib/utils";

// The live panel beside the AI interview: time, progress through the planned
// questions, the candidate's topics, pace, what's assessed and a tip for the
// current question. Desktop shows it as a column; phones fold it under the header.

export type Phase = "live" | "wrapup" | "ended";

export interface PanelData {
  phase: Phase;
  secondsLeft: number;
  /** Seconds the countdown started from (the interview, or the wrap-up). */
  totalSeconds: number;
  elapsed: number;
  questionNo: number;
  totalQuestions: number;
  minutesPerQuestion: number;
  /** No pace verdict before this many minutes (admin setting). */
  paceGraceMinutes: number;
  /** The question that covers each topic, once the plan exists. */
  topics: { name: string; question?: number }[];
  answers: number;
  avgWords: number;
  tip: string;
}

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

/** Timer color: calm, then amber in the last 5 minutes, rose while wrapping up. */
export function timerTone(phase: Phase, secondsLeft: number) {
  if (phase === "wrapup") return { ring: "stroke-rose-500", text: "text-rose-700", chip: "bg-rose-50 text-rose-700 border-rose-200" };
  if (secondsLeft <= 5 * 60) return { ring: "stroke-amber-500", text: "text-amber-700", chip: "bg-amber-50 text-amber-800 border-amber-200" };
  return { ring: "stroke-emerald-500", text: "text-emerald-700", chip: "bg-emerald-50 text-emerald-800 border-emerald-200" };
}

/** Where the candidate is against the clock. */
export function pace(d: PanelData) {
  // Too early to judge: a slow first answer shouldn't read as "behind".
  if (d.elapsed < d.paceGraceMinutes * 60)
    return {
      label: "Just started",
      note: `Your pace shows after the first ${d.paceGraceMinutes} minutes. Settle in.`,
      tone: "text-slate-700 bg-slate-50 border-slate-200",
      bar: "bg-slate-400",
    };
  // Questions finished so far against how many the time used would allow.
  const expected = d.elapsed / (d.minutesPerQuestion * 60);
  const diff = Math.max(0, d.questionNo - 1) - expected;
  if (diff > 1.5) return { label: "Ahead of time", note: "You've got time. Add detail and real examples.", tone: "text-sky-700 bg-sky-50 border-sky-200", bar: "bg-sky-500" };
  if (diff >= -1) return { label: "On track", note: "Good pace for the time you picked.", tone: "text-emerald-700 bg-emerald-50 border-emerald-200", bar: "bg-emerald-500" };
  if (diff >= -2) return { label: "A little behind", note: "Keep answers a bit shorter to cover everything.", tone: "text-amber-800 bg-amber-50 border-amber-200", bar: "bg-amber-500" };
  return { label: "Behind", note: "Lead with the main point; skip the long setup.", tone: "text-rose-700 bg-rose-50 border-rose-200", bar: "bg-rose-500" };
}

const METRIC_ICON: Record<MetricKey, typeof Brain> = {
  communication: MessageCircle,
  technical: Wrench,
  confidence: Sparkles,
  problemSolving: Brain,
  relevance: Target,
};

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card p-3.5", className)}>
      <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

export function TimerRing({ d, size = 112 }: { d: PanelData; size?: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const frac = d.totalSeconds ? Math.max(0, Math.min(1, d.secondsLeft / d.totalSeconds)) : 0;
  const tone = timerTone(d.phase, d.secondsLeft);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} className="fill-none stroke-muted" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          className={cn("fill-none transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none", tone.ring)}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-xl font-semibold tabular-nums", tone.text)}>{mmss(d.secondsLeft)}</span>
        <span className="text-[10px] text-muted-foreground">{d.phase === "wrapup" ? "to wrap up" : "left"}</span>
      </div>
    </div>
  );
}

export function QuestionTrack({ d }: { d: PanelData }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">
          Question {Math.min(d.questionNo, d.totalQuestions)}
          <span className="font-normal text-muted-foreground"> of about {d.totalQuestions}</span>
        </span>
      </div>
      <ol className="mt-2 flex flex-wrap gap-1.5" aria-label={`Question ${d.questionNo} of about ${d.totalQuestions}`}>
        {Array.from({ length: d.totalQuestions }, (_, i) => {
          const n = i + 1;
          const done = n < d.questionNo;
          const now = n === d.questionNo;
          return (
            <li
              key={n}
              className={cn(
                "size-2.5 rounded-full",
                done && "bg-emerald-500",
                now && "bg-primary ring-4 ring-primary/20",
                !done && !now && "bg-muted-foreground/20",
              )}
              aria-hidden
            />
          );
        })}
      </ol>
    </div>
  );
}

function TopicList({ d }: { d: PanelData }) {
  return (
    <ul className="space-y-1.5">
      {d.topics.map((t) => {
        const done = t.question !== undefined && t.question < d.questionNo;
        const now = t.question === d.questionNo;
        return (
          <li key={t.name} className="flex items-center gap-2 text-sm">
            {done ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
            ) : now ? (
              <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden>
                <span className="size-2.5 rounded-full bg-primary ring-4 ring-primary/20" />
              </span>
            ) : (
              <Circle className="size-4 shrink-0 text-muted-foreground/40" aria-hidden />
            )}
            <span className={cn("min-w-0 flex-1 truncate", !done && !now && "text-muted-foreground")}>{t.name}</span>
            <span className="sr-only">{done ? "covered" : now ? "now" : "coming up"}</span>
            {now && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Now</span>}
          </li>
        );
      })}
    </ul>
  );
}

function PaceBlock({ d }: { d: PanelData }) {
  const p = pace(d);
  return (
    <div className="space-y-2">
      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold", p.tone)}>
        <Gauge className="size-3.5" aria-hidden />
        {p.label}
      </span>
      <p className="text-xs leading-relaxed text-muted-foreground">{p.note}</p>
      <dl className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-muted/50 px-2 py-1.5">
          <dt className="text-[10px] text-muted-foreground">Answers</dt>
          <dd className="text-sm font-semibold tabular-nums">{d.answers}</dd>
        </div>
        <div className="rounded-lg bg-muted/50 px-2 py-1.5">
          <dt className="text-[10px] text-muted-foreground">Avg words</dt>
          <dd className="text-sm font-semibold tabular-nums">{d.avgWords}</dd>
        </div>
      </dl>
    </div>
  );
}

function TipBlock({ tip }: { tip: string }) {
  return (
    <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/60 p-3">
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
      <div>
        <p className="text-[11px] font-semibold tracking-wide text-amber-800 uppercase">Tip for this question</p>
        <p className="mt-0.5 text-sm leading-snug text-amber-950">{tip}</p>
      </div>
    </div>
  );
}

/** The desktop column. */
export function InterviewPanel({ d }: { d: PanelData }) {
  return (
    <div className="space-y-3">
      {d.phase !== "ended" && (
        <section className="flex items-center gap-4 rounded-xl border bg-card p-3.5">
          <TimerRing d={d} size={104} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Time</p>
            <p className="mt-1 text-sm">
              {d.phase === "wrapup" ? (
                <>The interviewer is wrapping up. It ends when this reaches 0.</>
              ) : (
                <>
                  <span className="font-medium tabular-nums">{mmss(d.elapsed)}</span>
                  <span className="text-muted-foreground"> used of {mmss(d.totalSeconds)}</span>
                </>
              )}
            </p>
          </div>
        </section>
      )}
      <Card title="Progress">
        <QuestionTrack d={d} />
      </Card>
      {d.phase !== "ended" && <TipBlock tip={d.tip} />}
      {d.topics.length > 0 && (
        <Card title="Your topics">
          <TopicList d={d} />
        </Card>
      )}
      {d.phase !== "ended" && (
        <Card title="Pace">
          <PaceBlock d={d} />
        </Card>
      )}
      <Card title="Scored at the end">
        <ul className="grid grid-cols-1 gap-1.5">
          {METRICS.map((m) => {
            const Icon = METRIC_ICON[m.key];
            return (
              <li key={m.key} className="flex items-center gap-2 text-sm">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-3.5" aria-hidden />
                </span>
                {m.label}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

/** Phones and tablets: the same information, folded under the header. */
export function InterviewPanelCompact({ d }: { d: PanelData }) {
  const p = pace(d);
  return (
    <details className="group rounded-xl border bg-card lg:hidden">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm">
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold", p.tone)}>
          <Gauge className="size-3" aria-hidden />
          {p.label}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">Topics, tip and pace</span>
        <span className="text-xs text-primary group-open:hidden">Show</span>
        <span className="hidden text-xs text-primary group-open:inline">Hide</span>
      </summary>
      <div className="space-y-3 border-t p-3">
        {d.phase !== "ended" && <TipBlock tip={d.tip} />}
        {d.topics.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Your topics</p>
            <TopicList d={d} />
          </div>
        )}
        <PaceBlock d={d} />
      </div>
    </details>
  );
}
