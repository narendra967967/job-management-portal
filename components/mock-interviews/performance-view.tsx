"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Brain,
  Flag,
  Hash,
  MessageCircle,
  Minus,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SampleBanner } from "@/components/mock-interviews/sample-banner";
import { ScoreTrendChart, SeriesDot, type TrendPoint } from "@/components/mock-interviews/score-trend-chart";
import { ScoreRing, SourceTag, Sparkline, bandTone } from "@/components/mock-interviews/visual-kit";
import { SAMPLE_INTERVIEWS, SAMPLE_SETTINGS, type SampleInterview } from "@/lib/mock-interviews/sample-data";
import { METRICS, overallScore, scoreBand, shortDate, type MetricKey } from "@/lib/mock-interviews/model";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

// Performance (spec D53): where the candidate stands and how each skill is moving,
// across AI and interviewer results (labeled by source). R1.2: sample data.

type Source = "all" | "ai" | "human";
type Measure = "overall" | MetricKey;

const W = SAMPLE_SETTINGS.weights;
const overallOf = (i: SampleInterview) => overallScore(i.scores!, W);
const METRIC_ICON: Record<MetricKey, LucideIcon> = {
  communication: MessageCircle,
  technical: Wrench,
  confidence: Sparkles,
  problemSolving: Brain,
  relevance: Target,
};

export function PerformanceView() {
  const mounted = useMounted();
  const [source, setSource] = useState<Source>("all");
  const [measure, setMeasure] = useState<Measure>("overall");
  const [asTable, setAsTable] = useState(false);

  const scored = useMemo(
    () => SAMPLE_INTERVIEWS.filter((i) => i.scores && (source === "all" || i.source === source)).sort((a, b) => a.date.localeCompare(b.date)),
    [source],
  );
  const valueOf = (i: SampleInterview) => (measure === "overall" ? overallOf(i) : i.scores![measure]);
  const points: TrendPoint[] = scored.map((i) => ({
    id: i.id,
    date: i.date,
    label: i.role,
    dateLabel: mounted ? shortDate(i.date).replace(/, \d{4}$/, "") : "",
    value: valueOf(i),
    series: i.source,
  }));

  // "Lately" = the last 5 scored interviews in view; "before" = the 5 before them.
  const recent = scored.slice(-5);
  const before = scored.slice(-10, -5);
  const avgOf = (list: SampleInterview[], k: MetricKey) => (list.length ? list.reduce((s, i) => s + i.scores![k], 0) / list.length : null);
  const ranked = [...METRICS].sort((a, b) => (avgOf(recent, b.key) ?? 0) - (avgOf(recent, a.key) ?? 0));
  const latest = scored[scored.length - 1];
  const first = scored[0];
  const best = scored.length ? scored.reduce((a, b) => (overallOf(b) > overallOf(a) ? b : a)) : undefined;
  const overalls = scored.map(overallOf);
  const average = overalls.length ? Math.round(overalls.reduce((a, b) => a + b, 0) / overalls.length) : 0;
  const measureLabel = measure === "overall" ? "Overall score" : METRICS.find((m) => m.key === measure)!.label;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <SampleBanner />

      {scored.length === 0 || !latest ? (
        <>
          <Hero />
          <div className="rounded-2xl border border-dashed bg-card p-10 text-center">
            <TrendingUp className="mx-auto size-10 text-primary/60" aria-hidden />
            <p className="mt-2 font-medium">Your scores show up here after your first interview</p>
            <Link href="/mock-interviews/ai" className={cn(buttonVariants({ size: "lg" }), "mt-4")}>
              Book an AI interview
            </Link>
          </div>
        </>
      ) : (
        <>
          <Hero latest={overallOf(latest)} first={first ? overallOf(first) : undefined} count={scored.length} />

          {/* Summary tiles */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile icon={Hash} tone="indigo" label="Interviews scored" value={String(scored.length)} />
            <Tile icon={TrendingUp} tone="sky" label="Average overall" value={`${average}/100`} />
            <Tile icon={Trophy} tone="emerald" label="Strongest lately" value={ranked[0].label} />
            <Tile icon={Target} tone="amber" label="Needs most work" value={ranked[ranked.length - 1].label} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            {/* Trend chart */}
            <section className="min-w-0 space-y-3 rounded-2xl border bg-card p-4 shadow-sm md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold">{measureLabel} over time</h2>
                <div role="radiogroup" aria-label="Which interviews" className="inline-grid grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1">
                  {(
                    [
                      ["all", "All"],
                      ["ai", "AI"],
                      ["human", "Interviewer"],
                    ] as const
                  ).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={source === v}
                      onClick={() => setSource(v)}
                      className={cn(
                        "min-h-11 rounded-lg px-3 text-xs font-medium sm:min-h-8",
                        source === v ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Phones: one dropdown; wider screens: a button per score. */}
              <select
                aria-label="Score to show"
                value={measure}
                onChange={(e) => setMeasure(e.target.value as Measure)}
                className="h-11 w-full rounded-lg border border-input bg-white/50 px-3 text-sm sm:hidden"
              >
                <option value="overall">Overall</option>
                {METRICS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
              <div className="hidden flex-wrap gap-1.5 sm:flex" role="radiogroup" aria-label="Score to show">
                {(["overall", ...METRICS.map((m) => m.key)] as Measure[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={measure === k}
                    onClick={() => setMeasure(k)}
                    className={cn(
                      "min-h-8 rounded-full border px-3 text-xs font-medium transition-colors",
                      measure === k ? "border-primary bg-primary text-white" : "bg-white/50 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    {k === "overall" ? "Overall" : METRICS.find((m) => m.key === k)!.label}
                  </button>
                ))}
              </div>

              {mounted && <ScoreTrendChart points={points} max={measure === "overall" ? 100 : 10} title={`${measureLabel} over time`} />}

              <button type="button" onClick={() => setAsTable((t) => !t)} className="min-h-11 text-xs text-primary hover:underline sm:min-h-0">
                {asTable ? "Hide the numbers" : "Show the numbers as a table"}
              </button>
              {asTable && (
                <div className="trend-viz overflow-x-auto rounded-xl border">
                  <table className="w-full min-w-[28rem] text-left text-sm">
                    <thead className="border-b bg-white/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Date</th>
                        <th className="px-3 py-2 font-medium">Interview</th>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 text-right font-medium">{measure === "overall" ? "Score /100" : "Score /10"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[...scored].reverse().map((i) => (
                        <tr key={i.id}>
                          <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">{mounted ? shortDate(i.date) : ""}</td>
                          <td className="px-3 py-2">
                            <Link href={`/mock-interviews/report/${i.id}`} className="hover:text-primary hover:underline">
                              {i.role}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            <span className="inline-flex items-center gap-1.5">
                              <SeriesDot series={i.source} />
                              {i.source === "ai" ? "AI" : "Interviewer"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">{valueOf(i)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Best and latest */}
            <div className="space-y-4">
              {best && <InterviewCard title="Your best interview" icon={Trophy} tone="text-amber-500" i={best} mounted={mounted} />}
              {/* When the latest is also the best, show where they started instead of repeating it. */}
              {best?.id === latest.id ? (
                first &&
                first.id !== latest.id && <InterviewCard title="Where you started" icon={Flag} tone="text-sky-600" i={first} mounted={mounted} />
              ) : (
                <InterviewCard title="Your latest interview" icon={TrendingUp} tone="text-primary" i={latest} mounted={mounted} />
              )}
            </div>
          </div>

          {/* Skill breakdown */}
          <section className="rounded-2xl border bg-card p-4 shadow-sm md:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold">Skill by skill</h2>
              <p className="text-xs text-muted-foreground">
                Average of your last {recent.length} {recent.length === 1 ? "interview" : "interviews"}
                {before.length ? `, compared with the ${before.length} before` : ""}
              </p>
            </div>
            <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {METRICS.map((m) => {
                const now = avgOf(recent, m.key) ?? 0;
                const prev = avgOf(before, m.key);
                const delta = prev === null ? null : Math.round((now - prev) * 10) / 10;
                const Icon = METRIC_ICON[m.key];
                const history = scored.slice(-8).map((i) => i.scores![m.key] * 10);
                return (
                  <li key={m.key} className="rounded-xl border bg-white/60 p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-medium">{m.label}</span>
                      <span className="text-sm font-semibold tabular-nums">
                        {now.toFixed(1)}
                        <span className="font-normal text-muted-foreground">/10</span>
                      </span>
                    </div>
                    <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500" style={{ width: `${now * 10}%` }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Delta value={delta} />
                      <Sparkline values={history} labels={[]} className="h-6 w-20" />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

/* ---------------- pieces ---------------- */

function Hero({ latest, first, count }: { latest?: number; first?: number; count?: number }) {
  const change = latest !== undefined && first !== undefined && count && count > 1 ? latest - first : null;
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-col gap-4 bg-gradient-to-r from-primary/12 via-violet-500/8 to-transparent p-4 sm:flex-row sm:items-center md:p-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-600 text-white shadow-sm">
            <TrendingUp className="size-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">Performance</h1>
            <p className="text-sm text-muted-foreground">How your scores are moving, skill by skill, across AI and interviewer reports.</p>
          </div>
        </div>
        {latest !== undefined && (
          <div className="flex items-center gap-3 rounded-xl border bg-white/70 px-3 py-2">
            <ScoreRing value={latest} size={56} />
            <div>
              <p className="text-[11px] text-muted-foreground">Latest overall</p>
              <p className={cn("text-sm font-semibold", bandTone(latest).text)}>{scoreBand(latest)}</p>
              {change !== null && (
                <p className={cn("text-xs font-medium", change > 0 ? "text-emerald-700" : change < 0 ? "text-rose-700" : "text-muted-foreground")}>
                  {change > 0 ? `+${change}` : change} since your first
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

const TILE_TONE = {
  indigo: "bg-primary/10 text-primary",
  sky: "bg-sky-100 text-sky-700",
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
} as const;

function Tile({ icon: Icon, tone, label, value }: { icon: LucideIcon; tone: keyof typeof TILE_TONE; label: string; value: string }) {
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", TILE_TONE[tone])}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm leading-snug font-semibold [overflow-wrap:anywhere] sm:text-base">{value}</span>
        <span className="block text-xs text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[11px] text-muted-foreground">Not enough to compare yet</span>;
  const up = value > 0;
  const down = value < 0;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        up ? "bg-emerald-50 text-emerald-700" : down ? "bg-rose-50 text-rose-700" : "bg-muted text-muted-foreground",
      )}
    >
      <Icon className="size-3" aria-hidden />
      {up ? `+${value}` : value} vs before
    </span>
  );
}

function InterviewCard({
  title,
  icon: Icon,
  tone,
  i,
  mounted,
}: {
  title: string;
  icon: LucideIcon;
  tone: string;
  i: SampleInterview;
  mounted: boolean;
}) {
  const overall = overallOf(i);
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        <Icon className={cn("size-4", tone)} aria-hidden />
        {title}
      </h2>
      <div className="mt-3 flex items-center gap-3">
        <ScoreRing value={overall} size={52} />
        <div className="min-w-0">
          <p className="truncate font-medium">{i.role}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <SourceTag source={i.source} name={i.interviewer} />
            <span className="text-xs text-muted-foreground">{mounted ? shortDate(i.date) : ""}</span>
          </div>
        </div>
      </div>
      <Link href={`/mock-interviews/report/${i.id}`} className={cn(buttonVariants({ variant: "ghost" }), "mt-2 px-0 text-xs")}>
        Open the report
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </section>
  );
}
