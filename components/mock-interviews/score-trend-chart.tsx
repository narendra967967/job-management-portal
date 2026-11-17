"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Score over attempts for one metric, one line per source (AI, interviewer).
// Dependency-free SVG, following the dataviz method: one axis, 2px lines, >= 8px
// markers with a surface ring, recessive grid, a legend only when both series
// show, the last value of each line labeled, a hover tooltip, and a table view on
// the page for anything the chart doesn't label. Series hues pass the palette
// validator (light: #2a78d6 / #eb6834; dark steps below).

export interface TrendPoint {
  id: string;
  date: string; // ISO
  label: string; // shown in the tooltip, e.g. the role
  dateLabel: string; // already formatted
  value: number;
  series: "ai" | "human";
}

const SERIES = {
  ai: { name: "AI", color: "var(--trend-ai)" },
  human: { name: "Interviewer", color: "var(--trend-human)" },
} as const;

const STYLE = `
.trend-viz { --trend-ai: #2a78d6; --trend-human: #eb6834; }
.dark .trend-viz { --trend-ai: #3987e5; --trend-human: #d95926; }
`;

const PAD = { top: 16, right: 40, bottom: 28, left: 34 };

export function ScoreTrendChart({ points, max, title }: { points: TrendPoint[]; max: number; title: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const descId = useId();
  // Drawn at the container's real width, so text stays 11px on a phone instead
  // of shrinking with a scaled-down drawing.
  const boxRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = W < 480 ? 220 : 240;
  if (points.length === 0) return null;

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (sorted.length === 1 ? innerW / 2 : (i / (sorted.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = max === 100 ? [0, 25, 50, 75, 100] : [0, 2, 4, 6, 8, 10];
  const present = (["ai", "human"] as const).filter((s) => sorted.some((p) => p.series === s));
  const hovered = sorted.find((p) => p.id === hover);
  const hoveredIdx = hovered ? sorted.indexOf(hovered) : -1;
  // A few date labels only: first, middle, last.
  const labelIdx = [...new Set([0, Math.floor((sorted.length - 1) / 2), sorted.length - 1])];

  return (
    <div className="trend-viz">
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      {present.length > 1 && (
        <ul className="mb-2 flex flex-wrap gap-4 text-xs text-muted-foreground" aria-label="Legend">
          {present.map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: SERIES[s].color }} aria-hidden />
              {SERIES[s].name}
            </li>
          ))}
        </ul>
      )}
      <div ref={boxRef} className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={title} aria-describedby={descId}>
          <desc id={descId}>
            {`${sorted.length} scores from ${sorted[0].dateLabel} to ${sorted[sorted.length - 1].dateLabel}. The table below lists every value.`}
          </desc>
          {/* Grid and axis labels: recessive. */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px]">
                {t}
              </text>
            </g>
          ))}
          {labelIdx.map((i) => (
            <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === sorted.length - 1 ? "end" : "middle"} className="fill-muted-foreground text-[11px]">
              {sorted[i].dateLabel}
            </text>
          ))}
          {hoveredIdx >= 0 && (
            <line x1={x(hoveredIdx)} x2={x(hoveredIdx)} y1={PAD.top} y2={PAD.top + innerH} className="stroke-muted-foreground/40" strokeWidth={1} />
          )}
          {/* One line per source, in date order. */}
          {present.map((s) => {
            const pts = sorted.map((p, i) => ({ p, i })).filter(({ p }) => p.series === s);
            const d = pts.map(({ p, i }, k) => `${k === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ");
            const last = pts[pts.length - 1];
            return (
              <g key={s}>
                {pts.length > 1 && <path d={d} fill="none" stroke={SERIES[s].color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
                {pts.map(({ p, i }) => (
                  <circle key={p.id} cx={x(i)} cy={y(p.value)} r={hover === p.id ? 6 : 4.5} fill={SERIES[s].color} className="stroke-card" strokeWidth={2} />
                ))}
                {/* Direct label on the last point only. */}
                <text x={x(last.i) + 9} y={y(last.p.value)} dy="0.32em" className="fill-foreground text-[11px] font-medium">
                  {last.p.value}
                </text>
              </g>
            );
          })}
          {/* Hit targets bigger than the marks. */}
          {sorted.map((p, i) => (
            <circle
              key={`hit-${p.id}`}
              cx={x(i)}
              cy={y(p.value)}
              r={14}
              fill="transparent"
              tabIndex={0}
              aria-label={`${p.dateLabel}, ${SERIES[p.series].name}: ${p.value}`}
              onMouseEnter={() => setHover(p.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(p.id)}
              onBlur={() => setHover(null)}
              className="cursor-pointer outline-none"
            />
          ))}
        </svg>
        {hovered && (
          <div
            className="pointer-events-none absolute z-10 w-max max-w-[14rem] -translate-x-1/2 -translate-y-full rounded-lg border bg-card px-2.5 py-1.5 text-xs shadow-md"
            style={{ left: `${(x(hoveredIdx) / W) * 100}%`, top: `${(y(hovered.value) / H) * 100}%`, marginTop: -10 }}
          >
            <p className="flex items-center gap-1.5 font-medium">
              <span className="size-2 rounded-full" style={{ background: SERIES[hovered.series].color }} aria-hidden />
              {hovered.value} · {SERIES[hovered.series].name}
            </p>
            <p className="text-muted-foreground">
              {hovered.dateLabel} · {hovered.label}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function SeriesDot({ series, className }: { series: "ai" | "human"; className?: string }) {
  return <span className={cn("inline-block size-2 rounded-full", className)} style={{ background: SERIES[series].color }} aria-hidden />;
}
