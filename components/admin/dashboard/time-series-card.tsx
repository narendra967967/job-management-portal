"use client";

// Admin dashboard time-series card with a daily/monthly/yearly range toggle.
// All three granularities are precomputed server-side (lib/admin/dashboard-data),
// so switching range is instant and needs no round-trip.

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { AreaChart, BarChart } from "@/components/admin/ui/charts";
import type { Granularity, TimeSeries } from "@/lib/admin/dashboard-data";

const RANGES: { value: Granularity; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export function TimeSeriesCard({
  title,
  series,
  unit,
  kind,
  href,
  defaultRange = "monthly",
}: {
  title: string;
  series: TimeSeries;
  unit: string;
  kind: "bar" | "area";
  href?: string;
  defaultRange?: Granularity;
}) {
  const [range, setRange] = useState<Granularity>(defaultRange);
  const data = series[range];
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>{title}</CardTitle>
        <div className="flex shrink-0 items-center gap-2">
          <select
            aria-label={`${title} range`}
            value={range}
            onChange={(e) => setRange(e.target.value as Granularity)}
            className="h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          {href && (
            <Link
              href={href}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View all <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {kind === "bar" ? (
          <BarChart data={data} unit={unit} />
        ) : (
          <AreaChart data={data} unit={unit} />
        )}
      </CardContent>
    </Card>
  );
}
