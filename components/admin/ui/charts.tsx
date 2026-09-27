"use client";

// Admin-only, dependency-free SVG charts. Kept self-contained (no user-app or
// external chart lib) so admin styling never crosses over. Follows the dataviz
// method: one axis, thin marks, recessive grid, a legend for >= 2 series, direct
// labels/values where color contrast needs relief, an SVG hover layer, and a
// categorical palette validated for CVD in both light and dark modes.
//
// Chrome/ink (grid, axis, text) reuse the app's theme tokens so they swap with
// the app's own light/dark mode. Series hues come from the validated dataviz
// reference palette, swapped under `.dark` to their dark-surface steps.

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

// Validated categorical palette (dataviz reference instance). Light order passes
// the adjacent CVD/normal-vision gates; dark steps clear >= 3:1 on the dark
// surface. Contrast WARN in light mode is relieved by the direct values/legend
// every categorical chart here ships.
export const VIZ_STYLE = `
.admin-viz {
  --series-1: #2a78d6; --series-2: #eb6834; --series-3: #1baf7a;
  --series-4: #eda100; --series-5: #e87ba4;
}
.dark .admin-viz {
  --series-1: #3987e5; --series-2: #d95926; --series-3: #199e70;
  --series-4: #c98500; --series-5: #d55181;
}
`;

/** Injects the palette variables once. Render near the top of a charts section. */
export function VizStyle() {
  return <style dangerouslySetInnerHTML={{ __html: VIZ_STYLE }} />;
}

const SERIES_VARS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
] as const;

export type Point = { label: string; value: number };

// Round a max up to a friendly axis top (e.g. 42 -> 50, 380 -> 400).
function niceMax(max: number) {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `${n}`;
}

// ---------------------------------------------------------------------------
// Area + line chart — single series over time.
// ---------------------------------------------------------------------------

export function AreaChart({
  data,
  unit = "",
  className,
}: {
  data: Point[];
  unit?: string;
  className?: string;
}) {
  const gid = useId().replace(/:/g, "");
  const [active, setActive] = useState<number | null>(null);

  const W = 680;
  const H = 260;
  const padL = 40;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const top = niceMax(Math.max(...data.map((d) => d.value), 0));
  const x = (i: number) =>
    padL + (data.length === 1 ? plotW / 2 : (plotW * i) / (data.length - 1));
  const y = (v: number) => padT + plotH - (plotH * v) / top;

  const line = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const area = `${padL},${padT + plotH} ${line} ${x(data.length - 1)},${padT + plotH}`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => top * t);

  return (
    <div className={cn("admin-viz w-full", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        onMouseLeave={() => setActive(null)}
      >
        <defs>
          <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--series-1)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--series-1)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines + y labels */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={padL - 6}
              y={y(t) + 3}
              textAnchor="end"
              className="fill-muted-foreground"
              style={{ fontSize: 10 }}
            >
              {fmt(t)}
            </text>
          </g>
        ))}

        <polygon points={area} fill={`url(#fill-${gid})`} />
        <polyline
          points={line}
          fill="none"
          stroke="var(--series-1)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* x labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontSize: 10 }}
          >
            {d.label}
          </text>
        ))}

        {/* Hover crosshair + active dot */}
        {active !== null && (
          <line
            x1={x(active)}
            x2={x(active)}
            y1={padT}
            y2={padT + plotH}
            stroke="var(--series-1)"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.6}
          />
        )}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(d.value)}
            r={active === i ? 4.5 : 3}
            fill="var(--series-1)"
            stroke="var(--card)"
            strokeWidth={2}
          />
        ))}

        {/* Tooltip */}
        {active !== null && (
          <Tooltip
            x={x(active)}
            y={y(data[active].value)}
            plotW={W}
            title={data[active].label}
            value={`${fmt(data[active].value)}${unit ? ` ${unit}` : ""}`}
          />
        )}

        {/* Hit areas */}
        {data.map((d, i) => (
          <rect
            key={i}
            x={i === 0 ? padL : (x(i) + x(i - 1)) / 2}
            y={padT}
            width={
              i === 0
                ? (x(1) - padL) / 2 + (x(1) - x(0)) / 2 || plotW
                : i === data.length - 1
                  ? (x(i) - x(i - 1)) / 2 + padR
                  : (x(i + 1) - x(i - 1)) / 2
            }
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setActive(i)}
          />
        ))}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bar chart — single series across categories or time.
// ---------------------------------------------------------------------------

export function BarChart({
  data,
  unit = "",
  className,
}: {
  data: Point[];
  unit?: string;
  className?: string;
}) {
  const [active, setActive] = useState<number | null>(null);

  const W = 680;
  const H = 260;
  const padL = 40;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const top = niceMax(Math.max(...data.map((d) => d.value), 0));
  const slot = plotW / data.length;
  const barW = Math.min(slot * 0.6, 48);
  const y = (v: number) => padT + plotH - (plotH * v) / top;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => top * t);

  return (
    <div className={cn("admin-viz w-full", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        onMouseLeave={() => setActive(null)}
      >
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={padL - 6}
              y={y(t) + 3}
              textAnchor="end"
              className="fill-muted-foreground"
              style={{ fontSize: 10 }}
            >
              {fmt(t)}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const cx = padL + slot * i + slot / 2;
          const h = plotH - (y(d.value) - padT);
          return (
            <g
              key={i}
              onMouseEnter={() => setActive(i)}
              style={{ cursor: "default" }}
            >
              <rect
                x={cx - slot / 2}
                y={padT}
                width={slot}
                height={plotH}
                fill="transparent"
              />
              <rect
                x={cx - barW / 2}
                y={y(d.value)}
                width={barW}
                height={Math.max(h, 0)}
                rx={4}
                fill="var(--series-1)"
                opacity={active === null || active === i ? 1 : 0.5}
              />
              <text
                x={cx}
                y={H - 8}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: 10 }}
              >
                {d.label}
              </text>
            </g>
          );
        })}

        {active !== null && (
          <Tooltip
            x={padL + slot * active + slot / 2}
            y={y(data[active].value)}
            plotW={W}
            title={data[active].label}
            value={`${fmt(data[active].value)}${unit ? ` ${unit}` : ""}`}
          />
        )}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Donut — categorical share of a whole. Legend carries color + value + %.
// ---------------------------------------------------------------------------

export function DonutChart({
  data,
  centerLabel,
  className,
}: {
  data: Point[];
  centerLabel?: string;
  className?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);

  const size = 180;
  const r = 70;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const gap = 2; // surface gap between segments (px on the stroke)

  let offset = 0;
  const segments = data.map((d, i) => {
    const frac = total > 0 ? d.value / total : 0;
    const len = Math.max(frac * circ - gap, 0);
    const seg = { d, i, len, dashOffset: -offset, frac };
    offset += frac * circ;
    return seg;
  });

  return (
    <div
      className={cn(
        "admin-viz flex flex-col items-center gap-4",
        className,
      )}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-36 w-36 shrink-0 -rotate-90"
        role="img"
        onMouseLeave={() => setActive(null)}
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={16}
        />
        {segments.map((s) => (
          <circle
            key={s.i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={SERIES_VARS[s.i % SERIES_VARS.length]}
            strokeWidth={active === s.i ? 20 : 16}
            strokeDasharray={`${s.len} ${circ - s.len}`}
            strokeDashoffset={s.dashOffset}
            strokeLinecap="butt"
            onMouseEnter={() => setActive(s.i)}
            style={{ transition: "stroke-width 120ms" }}
          />
        ))}
        {/* Center total (counter-rotate to upright) */}
        <g transform={`rotate(90 ${cx} ${cy})`}>
          <text
            x={cx}
            y={cy - 2}
            textAnchor="middle"
            className="fill-foreground"
            style={{ fontSize: 22, fontWeight: 600 }}
          >
            {active === null ? fmt(total) : fmt(data[active].value)}
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontSize: 9 }}
          >
            {active === null ? centerLabel ?? "Total" : data[active].label}
          </text>
        </g>
      </svg>

      {/* Legend with direct values (relief for light-mode contrast WARN) */}
      <ul className="w-full space-y-1.5">
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <li
              key={d.label}
              className="flex items-center gap-2 text-sm"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <span
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ background: SERIES_VARS[i % SERIES_VARS.length] }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {d.label}
              </span>
              <span className="shrink-0 font-medium tabular-nums">{d.value}</span>
              <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Shared SVG tooltip — flips to stay inside the plot horizontally.
function Tooltip({
  x,
  y,
  plotW,
  title,
  value,
}: {
  x: number;
  y: number;
  plotW: number;
  title: string;
  value: string;
}) {
  const w = Math.max(title.length, value.length) * 6.2 + 20;
  const h = 34;
  const flip = x + w + 12 > plotW;
  const bx = flip ? x - w - 10 : x + 10;
  const by = Math.max(y - h - 8, 4);
  return (
    <g pointerEvents="none">
      <rect
        x={bx}
        y={by}
        width={w}
        height={h}
        rx={6}
        fill="var(--foreground)"
        opacity={0.92}
      />
      <text
        x={bx + 10}
        y={by + 14}
        className="fill-background"
        style={{ fontSize: 10, opacity: 0.8 }}
      >
        {title}
      </text>
      <text
        x={bx + 10}
        y={by + 27}
        className="fill-background"
        style={{ fontSize: 12, fontWeight: 600 }}
      >
        {value}
      </text>
    </g>
  );
}
