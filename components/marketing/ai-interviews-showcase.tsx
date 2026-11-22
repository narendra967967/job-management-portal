"use client";

// Pictures for the public AI mock interviews page (app/ai-mock-interviews):
// small versions of the real screens for "How it works", and a sample report
// drawn with the same chart pieces the app's report and Performance pages use.
// Everything here is made-up sample data and is labeled as such.
//
// Owner rule: the sample must not reveal how the overall score is weighted
// (Module settings → Scoring), so skill bars carry words, not numbers out of
// 10, and no skill figures sit next to the overall score.

import { useEffect, useState } from "react";
import { ArrowUpRight, Check, Kanban, ListChecks, Mic, Sparkles, TriangleAlert } from "lucide-react";
import { ScoreRing, bandTone } from "@/components/mock-interviews/visual-kit";
import { ScoreTrendChart, type TrendPoint } from "@/components/mock-interviews/score-trend-chart";
import { METRICS, scoreBand } from "@/lib/mock-interviews/model";
import { cn } from "@/lib/utils";

/* ---------------- How it works: three small screens ---------------- */

export function SetupMock() {
  return (
    <div className="space-y-2.5 rounded-2xl bg-white/70 p-3.5 text-left shadow-sm ring-1 ring-white/80" aria-hidden>
      <div>
        <p className="text-[10px] font-medium text-muted-foreground">Role</p>
        <p className="mt-0.5 rounded-lg border bg-white px-2.5 py-1.5 text-xs">Technical Project Manager</p>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary">
        <Kanban className="size-3.5" /> Project management
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
        {["Easy", "Medium", "Hard"].map((d) => (
          <span key={d} className={cn("rounded-lg border bg-white py-1.5", d === "Medium" && "border-amber-300 bg-amber-50 font-semibold text-amber-800")}>
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5 text-center text-[11px]">
        {[15, 30, 45, 60].map((m) => (
          <span key={m} className={cn("rounded-lg border bg-white py-1.5", m === 30 && "border-primary/50 bg-primary/5 font-semibold text-primary")}>
            {m} min
          </span>
        ))}
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-emerald-700">
        <Check className="size-3.5" /> Job description from your lead
      </p>
    </div>
  );
}

export function InterviewMock() {
  return (
    <div className="space-y-3 rounded-2xl bg-white/70 p-3.5 text-left shadow-sm ring-1 ring-white/80" aria-hidden>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
          <span className="size-1.5 rounded-full bg-emerald-500" /> Live
        </span>
        <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 tabular-nums">18:42</span>
      </div>
      <div>
        <p className="text-[11px]">
          Question 3 <span className="text-muted-foreground">of about 15</span>
        </p>
        <div className="mt-1.5 flex gap-1">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={cn("size-2 rounded-full", i < 2 ? "bg-primary/40" : i === 2 ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
      </div>
      <p className="rounded-xl rounded-bl-sm border-l-2 border-primary bg-white px-2.5 py-2 text-[11px] leading-snug">
        Tell me about a time a vendor missed a date you&apos;d promised a client.
      </p>
      <div className="flex items-center gap-2 rounded-xl border bg-white p-1.5 pl-2.5">
        <span className="flex-1 text-[11px] text-muted-foreground">Type or speak your answer</span>
        <span className="flex size-7 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
          <Mic className="size-3.5" />
        </span>
      </div>
    </div>
  );
}

export function ReportMock() {
  return (
    <div className="rounded-2xl bg-white/70 p-3.5 text-left shadow-sm ring-1 ring-white/80" aria-hidden>
      <div className="flex items-center gap-3">
        <ScoreRing value={72} size={52} />
        <div>
          <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold", bandTone(72).chip)}>{scoreBand(72)}</span>
          <p className="mt-1 text-[11px] text-muted-foreground">Ready in under a minute</p>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5 text-[11px]">
        <li className="flex items-center gap-1.5">
          <Check className="size-3.5 text-emerald-600" /> What went well
        </li>
        <li className="flex items-center gap-1.5">
          <TriangleAlert className="size-3.5 text-rose-600" /> Answers to work on, with better ones
        </li>
        <li className="flex items-center gap-1.5">
          <ListChecks className="size-3.5 text-sky-600" /> Your action plan
        </li>
      </ul>
    </div>
  );
}

/* ---------------- the sample report ---------------- */

// Six practice interviews, improving. Sample data only.
const TREND = [48, 53, 57, 61, 66, 72];
const TREND_POINTS: TrendPoint[] = TREND.map((value, i) => ({
  id: `s${i}`,
  date: `2026-01-0${i + 1}`,
  label: "Sample interview",
  dateLabel: `Interview ${i + 1}`,
  value,
  series: "ai",
}));

// Bar lengths only (this interview and the last one); shown with a word, never a number.
const SKILLS: Record<(typeof METRICS)[number]["key"], { now: number; before: number }> = {
  communication: { now: 82, before: 74 },
  technical: { now: 64, before: 60 },
  confidence: { now: 76, before: 66 },
  problemSolving: { now: 52, before: 50 },
  relevance: { now: 70, before: 62 },
};
const word = (v: number) => (v >= 75 ? { text: "Strong", cls: "text-emerald-700 bg-emerald-50" } : v >= 60 ? { text: "Solid", cls: "text-primary bg-primary/10" } : { text: "Work on", cls: "text-amber-800 bg-amber-50" });

export function SampleReport() {
  // The trend chart measures its box, so it draws after the page has loaded.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const overall = TREND[TREND.length - 1];
  const tone = bandTone(overall);
  const r = 42;
  const c = 2 * Math.PI * r;

  return (
    <div className="glass rounded-3xl p-3 sm:p-4">
      <div className="space-y-3 rounded-2xl bg-white/45 p-3 sm:p-4">
        {/* Score */}
        <section className="overflow-hidden rounded-2xl border border-white/80 bg-white/80 shadow-sm">
          <div className="flex flex-col gap-4 bg-gradient-to-r from-primary/12 via-violet-500/8 to-transparent p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <div className="relative size-24 shrink-0">
                <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
                  <circle cx="50" cy="50" r={r} className="fill-none stroke-muted" strokeWidth="9" />
                  <circle cx="50" cy="50" r={r} className={cn("fill-none", tone.ring)} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - overall / 100)} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-semibold tabular-nums">{overall}</span>
                  <span className="text-[10px] text-muted-foreground">out of 100</span>
                </div>
              </div>
              <div>
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  <Sparkles className="size-3" aria-hidden /> Sample report
                </span>
                <p className="mt-1.5 font-semibold">Technical Project Manager</p>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                  {["Project management", "Medium", "30 min"].map((t) => (
                    <span key={t} className="rounded-md border bg-white/80 px-1.5 py-0.5 text-muted-foreground">
                      {t}
                    </span>
                  ))}
                  <span className={cn("rounded-full border px-2 py-0.5 font-semibold", tone.chip)}>{scoreBand(overall)}</span>
                </div>
              </div>
            </div>
          </div>
          <dl className="grid grid-cols-3 divide-x border-t text-left">
            <div className="min-w-0 px-2.5 py-2.5 sm:px-3">
              <dt className="text-[11px] text-muted-foreground">Since last time</dt>
              <dd className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
                <ArrowUpRight className="size-4" aria-hidden /> +{overall - TREND[TREND.length - 2]}
              </dd>
            </div>
            <div className="min-w-0 px-2.5 py-2.5 sm:px-3">
              <dt className="text-[11px] text-muted-foreground">Strongest</dt>
              <dd className="mt-0.5 text-[13px] font-semibold break-words sm:text-sm">Communication</dd>
            </div>
            <div className="min-w-0 px-2.5 py-2.5 sm:px-3">
              <dt className="text-[11px] text-muted-foreground">Focus on</dt>
              <dd className="mt-0.5 text-[13px] font-semibold break-words sm:text-sm">Problem-solving</dd>
            </div>
          </dl>
        </section>

        <div className="grid gap-3 lg:grid-cols-2">
          {/* Skills */}
          <section className="rounded-2xl border border-white/80 bg-white/80 p-4 text-left shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Your skills</h3>
              <ul className="flex items-center gap-3 text-[11px] text-muted-foreground" aria-label="Legend">
                <li className="flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded-full bg-primary" aria-hidden /> This interview
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-3 w-0.5 rounded-full bg-slate-700" aria-hidden /> Last one
                </li>
              </ul>
            </div>
            <ul className="mt-4 space-y-3.5">
              {METRICS.map((m) => {
                const s = SKILLS[m.key];
                const w = word(s.now);
                return (
                  <li key={m.key}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span>{m.label}</span>
                      <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-semibold", w.cls)}>{w.text}</span>
                    </div>
                    <div className="relative mt-1.5 h-2.5 rounded-full bg-muted" aria-hidden>
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500" style={{ width: `${s.now}%` }} />
                      <span className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-700" style={{ left: `${s.before}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Progress over time */}
          <section className="rounded-2xl border border-white/80 bg-white/80 p-4 text-left shadow-sm">
            <h3 className="text-sm font-semibold">Overall score over time</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Your Performance page tracks every interview.</p>
            <div className="mt-2 min-h-[220px]">{mounted && <ScoreTrendChart points={TREND_POINTS} max={100} title="Sample overall score over six interviews" />}</div>
          </section>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {/* Answers to work on */}
          <section className="rounded-2xl border border-rose-200 bg-white/80 p-4 text-left shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-rose-700">
              <TriangleAlert className="size-4 text-rose-600" aria-hidden /> Answers to work on
            </h3>
            <p className="mt-3 text-sm font-medium">How do you decide when to escalate a delayed dependency?</p>
            <p className="mt-2 text-[12px] text-muted-foreground">
              <span className="font-semibold text-rose-700">What was missing:</span> a clear trigger for escalating.
            </p>
            <p className="mt-2 rounded-xl bg-emerald-50/80 p-2.5 text-[12px] leading-relaxed text-emerald-900">
              <span className="font-semibold">A better answer:</span> &ldquo;I escalate the day a delay threatens a milestone, not when it first
              appears. I bring the owner the impact, two options and the date I need a decision by.&rdquo;
            </p>
          </section>

          {/* Action plan */}
          <section className="rounded-2xl border border-white/80 bg-white/80 p-4 text-left shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-sky-700">
              <ListChecks className="size-4 text-sky-600" aria-hidden /> Your action plan
            </h3>
            <ol className="mt-3 space-y-2.5">
              {[
                ["Two risk stories", "Prepare two risk stories with a clear trigger, action and result."],
                ["Outcome first", "Open each answer with the result, then explain how you got there."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3 rounded-xl border border-sky-100 bg-sky-50/60 p-2.5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-semibold text-white">{i + 1}</span>
                  <span>
                    <span className="block text-sm font-semibold">{t}</span>
                    <span className="block text-[12px] text-muted-foreground">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
