"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SampleBanner } from "@/components/mock-interviews/sample-banner";
import { ScoreTrendChart, SeriesDot, type TrendPoint } from "@/components/mock-interviews/score-trend-chart";
import { SAMPLE_INTERVIEWS, SAMPLE_SETTINGS } from "@/lib/mock-interviews/sample-data";
import { METRICS, overallScore, shortDate, type MetricKey } from "@/lib/mock-interviews/model";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

// Performance (spec D53): a trend per metric across attempts, AI and interviewer
// results labeled by source. R1.2: sample data.

type Source = "all" | "ai" | "human";
type Measure = "overall" | MetricKey;

export function PerformanceView() {
  const mounted = useMounted();
  const [source, setSource] = useState<Source>("all");
  const [measure, setMeasure] = useState<Measure>("overall");
  const [asTable, setAsTable] = useState(false);

  const scored = useMemo(
    () => SAMPLE_INTERVIEWS.filter((i) => i.scores && (source === "all" || i.source === source)).sort((a, b) => a.date.localeCompare(b.date)),
    [source],
  );
  const valueOf = (i: (typeof scored)[number]) =>
    measure === "overall" ? overallScore(i.scores!, SAMPLE_SETTINGS.weights) : i.scores![measure];
  const points: TrendPoint[] = scored.map((i) => ({
    id: i.id,
    date: i.date,
    label: i.role,
    dateLabel: mounted ? shortDate(i.date).replace(/, \d{4}$/, "") : "",
    value: valueOf(i),
    series: i.source,
  }));

  // Averages per metric over the last 5 scored interviews in view.
  const recent = scored.slice(-5);
  const avg = (k: MetricKey) => (recent.length ? recent.reduce((s, i) => s + i.scores![k], 0) / recent.length : 0);
  const ranked = [...METRICS].sort((a, b) => avg(b.key) - avg(a.key));
  const latest = scored[scored.length - 1];
  const measureLabel = measure === "overall" ? "Overall score" : METRICS.find((m) => m.key === measure)!.label;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <SampleBanner />
      <h1 className="text-lg font-semibold tracking-tight">Performance</h1>

      {scored.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          Finish an interview and your scores start showing here.{" "}
          <Link href="/mock-interviews/ai" className="text-primary hover:underline">
            Start an AI interview
          </Link>
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Tile label="Interviews scored" value={String(scored.length)} />
            <Tile label="Latest overall" value={latest ? `${overallScore(latest.scores!, SAMPLE_SETTINGS.weights)}/100` : "-"} />
            <Tile label="Strongest skill" value={ranked[0].label} note={`${avg(ranked[0].key).toFixed(1)}/10 lately`} />
            <Tile label="Needs most work" value={ranked[ranked.length - 1].label} note={`${avg(ranked[ranked.length - 1].key).toFixed(1)}/10 lately`} />
          </div>

          <section className="space-y-3 rounded-xl border bg-card p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium">{measureLabel} over time</h2>
              <div role="radiogroup" aria-label="Which interviews" className="inline-grid grid-cols-3 gap-1 rounded-lg bg-muted/60 p-1">
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
                      "min-h-11 rounded-md px-3 text-xs font-medium sm:min-h-8",
                      source === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
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
                    "min-h-11 rounded-full border px-3 text-xs font-medium transition-colors sm:min-h-8",
                    measure === k ? "border-primary bg-primary/5 text-primary" : "bg-white/50 text-muted-foreground hover:text-foreground",
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
              <div className="trend-viz overflow-x-auto rounded-lg border">
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
        </>
      )}
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base leading-snug font-semibold">
        {value}
      </p>
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}
