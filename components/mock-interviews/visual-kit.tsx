"use client";

import { Bot, UserRound } from "lucide-react";
import type { Difficulty, ReportSource } from "@/lib/mock-interviews/model";
import { cn } from "@/lib/utils";

// Visual pieces shared by the Mock interviews screens (report, history,
// performance, bookings), so colors mean the same thing everywhere:
// score bands, difficulty, and AI vs interviewer.

/** Overall-score band colors, always shown next to the band's word. */
export function bandTone(overall: number) {
  if (overall >= 85) return { ring: "stroke-emerald-500", text: "text-emerald-700", chip: "bg-emerald-50 text-emerald-800 border-emerald-200", fill: "bg-emerald-500" };
  if (overall >= 70) return { ring: "stroke-primary", text: "text-primary", chip: "bg-primary/10 text-primary border-primary/20", fill: "bg-primary" };
  if (overall >= 50) return { ring: "stroke-amber-500", text: "text-amber-700", chip: "bg-amber-50 text-amber-800 border-amber-200", fill: "bg-amber-500" };
  return { ring: "stroke-rose-500", text: "text-rose-700", chip: "bg-rose-50 text-rose-700 border-rose-200", fill: "bg-rose-500" };
}

/** Difficulty tag colors: Easy green, Medium amber, Hard red. */
export const LEVEL_TAG: Record<Difficulty, string> = {
  Easy: "bg-emerald-50 text-emerald-800 border-emerald-200",
  Medium: "bg-amber-50 text-amber-800 border-amber-200",
  Hard: "bg-rose-50 text-rose-800 border-rose-200",
};

export function LevelTag({ level, className }: { level: Difficulty; className?: string }) {
  return <span className={cn("inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-medium", LEVEL_TAG[level], className)}>{level}</span>;
}

/** AI (indigo) or interviewer (orange), with an icon so color isn't the only cue. */
export function SourceTag({ source, name }: { source: ReportSource; name?: string }) {
  const human = source === "human";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        human ? "border-orange-200 bg-orange-50 text-orange-800" : "border-primary/20 bg-primary/10 text-primary",
      )}
    >
      {human ? <UserRound className="size-3" aria-hidden /> : <Bot className="size-3" aria-hidden />}
      {human ? (name ? `Interviewer · ${name}` : "Interviewer") : "AI"}
    </span>
  );
}

/** A small score ring (overall /100) colored by band. */
export function ScoreRing({ value, size = 40, className }: { value: number; size?: number; className?: string }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const tone = bandTone(value);
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" className="size-full -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r={r} className="fill-none stroke-muted" strokeWidth="4" />
        <circle cx="18" cy="18" r={r} className={cn("fill-none", tone.ring)} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums">{value}</span>
    </span>
  );
}

/** A tiny trend line of overall scores, the latest dot emphasised. */
export function Sparkline({ values, labels, className }: { values: number[]; labels: string[]; className?: string }) {
  if (values.length < 2) return <span className="text-muted-foreground">Not enough yet</span>;
  const W = 120;
  const H = 32;
  const min = Math.min(...values) - 5;
  const max = Math.max(...values) + 5;
  const x = (i: number) => 4 + (i / (values.length - 1)) * (W - 8);
  const y = (v: number) => H - 4 - ((v - min) / (max - min || 1)) * (H - 8);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  const last = values.length - 1;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn("h-8 w-[7.5rem]", className)}
      role="img"
      aria-label={`Overall scores, oldest to newest: ${values.map((v, i) => (labels[i] ? `${labels[i]} ${v}` : v)).join(", ")}`}
    >
      <path d={d} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(values[last])} r={3.5} className="fill-primary stroke-card" strokeWidth={2} />
    </svg>
  );
}
