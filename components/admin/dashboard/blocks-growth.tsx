"use client";

// Dashboard blocks about growth and money: the four tiles, sign-up and
// sign-in charts, plans, the onboarding funnel, revenue and unfinished orders.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, IndianRupee, ReceiptText, UserCheck, Users, type LucideIcon } from "lucide-react";
import { Card } from "@/components/admin/ui/card";
import { AreaChart, BarChart, DonutChart } from "@/components/admin/ui/charts";
import {
  bucketRange,
  changeText,
  formatCount,
  formatMoney,
  links,
  type DashboardData,
  type TimeSeries,
} from "@/lib/admin/dashboard-model";
import { timeAgo } from "@/lib/email-intake-model";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";
import { BlockCard, Note, StatRow } from "./parts";

export interface BlockProps {
  data: DashboardData;
  /** The selected period as YYYY-MM-DD dates, for filtered links. */
  range: { from: string; to: string };
}

/* ---------------- tiles ---------------- */

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  change,
  note,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  change?: { text: string; up: boolean } | null;
  note?: string;
  href: string;
}) {
  return (
    <Link href={href} className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <Card className="flex h-full items-start gap-3 p-4 transition-colors group-hover:border-primary/40">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          {change && (
            <p className={cn("text-xs font-medium", change.up ? "text-status-applied-foreground" : "text-destructive")}>
              {change.text}
            </p>
          )}
          {note && <Note>{note}</Note>}
        </div>
      </Card>
    </Link>
  );
}

export function TotalUsersTile({ data, range }: BlockProps) {
  const u = data.users;
  return (
    <Tile
      icon={Users}
      label="Total users"
      value={formatCount(u.total)}
      sub={`${formatCount(u.joined)} joined in this period`}
      change={changeText(u.joined, u.joinedPrev)}
      href={links.users({ joinedFrom: range.from, joinedTo: range.to })}
    />
  );
}

export function SignedInTile({ data, range }: BlockProps) {
  const s = data.signedIn;
  const pct = data.users.total > 0 ? Math.round((s.count / data.users.total) * 100) : 0;
  return (
    <Tile
      icon={UserCheck}
      label="Signed in"
      value={formatCount(s.count)}
      sub={`${pct}% of all users`}
      change={changeText(s.count, s.prev)}
      href={links.users({ signedInFrom: range.from, signedInTo: range.to })}
    />
  );
}

export function PaidUsersTile({ data }: BlockProps) {
  const p = data.paid;
  const diff = p.prevConversionPct === null ? null : p.conversionPct - p.prevConversionPct;
  return (
    <Tile
      icon={CreditCard}
      label="Paid users"
      value={formatCount(p.count)}
      sub={`${p.conversionPct}% of new sign-ups paid`}
      change={diff === null ? null : { text: diff === 0 ? "Same as previous period" : `${diff > 0 ? "+" : ""}${diff} points vs previous period`, up: diff >= 0 }}
      href={links.users({ plan: "paid" })}
    />
  );
}

export function RevenueTile({ data, range }: BlockProps) {
  const r = data.revenue;
  return (
    <Tile
      icon={IndianRupee}
      label="Revenue"
      value={formatMoney(r.total, r.currency)}
      sub={`${formatCount(r.orders)} paid orders`}
      change={changeText(r.total, r.prev)}
      note="Excludes GST and test payments"
      href={links.orders({ status: "paid", from: range.from, to: range.to, mode: "live" })}
    />
  );
}

/* ---------------- time series ---------------- */

type Granularity = keyof TimeSeries;
const RANGES: { value: Granularity; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

function RangeSelect({ title, value, onChange }: { title: string; value: Granularity; onChange: (g: Granularity) => void }) {
  return (
    <select
      aria-label={`${title} range`}
      value={value}
      onChange={(e) => onChange(e.target.value as Granularity)}
      className="h-11 rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-8"
    >
      {RANGES.map((r) => (
        <option key={r.value} value={r.value}>
          {r.label}
        </option>
      ))}
    </select>
  );
}

export function NewUsersBlock({ data }: BlockProps) {
  const [g, setG] = useState<Granularity>("monthly");
  const router = useRouter();
  const rows = data.newUsers[g];
  return (
    <BlockCard title="New users" href={links.users()} action={<RangeSelect title="New users" value={g} onChange={setG} />}>
      <BarChart
        data={rows}
        unit="users"
        label="Sign-ups"
        overlay={{ data: data.newPaidUsers[g], label: "Became paid" }}
        onSelect={(i) => {
          const b = bucketRange(g, i, rows.length);
          router.push(links.users({ joinedFrom: b.from, joinedTo: b.to }));
        }}
      />
    </BlockCard>
  );
}

export function ActiveUsersBlock({ data }: BlockProps) {
  const [g, setG] = useState<Granularity>("monthly");
  const router = useRouter();
  const rows = data.activeUsers[g];
  return (
    <BlockCard title="Active users" href={links.users()} action={<RangeSelect title="Active users" value={g} onChange={setG} />}>
      <AreaChart
        data={rows}
        unit="users signed in"
        onSelect={(i) => {
          const b = bucketRange(g, i, rows.length);
          router.push(links.users({ signedInFrom: b.from, signedInTo: b.to }));
        }}
      />
    </BlockCard>
  );
}

/* ---------------- plans ---------------- */

export function PlansBlock({ data }: BlockProps) {
  return (
    <BlockCard title="Plan distribution" href={links.users()}>
      <DonutChart data={data.planMix} centerLabel="Users" hrefs={data.planMix.map((p) => links.users({ plan: p.plan }))} />
    </BlockCard>
  );
}

/* ---------------- funnel ---------------- */

export function FunnelBlock({ data, range }: BlockProps) {
  const first = data.funnel[0]?.value ?? 0;
  return (
    <BlockCard
      title="Onboarding funnel"
      href={links.users({ joinedFrom: range.from, joinedTo: range.to })}
      info="People who signed up in the selected period. Click a step to see who stopped there."
    >
      <ol className="space-y-0.5">
        {data.funnel.map((s, i) => {
          const pct = first > 0 ? Math.round((s.value / first) * 100) : 0;
          const next = data.funnel[i + 1];
          const stuck = next ? s.value - next.value : 0;
          return (
            <li key={s.key}>
              <Link
                href={links.users({ joinedFrom: range.from, joinedTo: range.to, step: s.key })}
                className="-mx-2 block min-h-11 rounded-lg px-2 py-1.5 hover:bg-muted/60"
              >
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium">{s.label}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatCount(s.value)} · {pct}%{next && stuck > 0 ? ` · ${formatCount(stuck)} stopped` : ""}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </BlockCard>
  );
}

/* ---------------- revenue ---------------- */

export function RevenueBlock({ data, range }: BlockProps) {
  const r = data.revenue;
  const change = changeText(r.total, r.prev);
  const router = useRouter();
  const planTotal = r.byPlan.reduce((a, b) => a + b.value, 0);
  return (
    <BlockCard
      title="Revenue"
      icon={IndianRupee}
      href={links.orders({ status: "paid", from: range.from, to: range.to, mode: "live" })}
      cta="Orders"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-2xl font-semibold tabular-nums">{formatMoney(r.total, r.currency)}</p>
            {change && (
              <p className={cn("text-xs font-medium", change.up ? "text-status-applied-foreground" : "text-destructive")}>{change.text}</p>
            )}
          </div>
          <Note>Excludes GST and test payments</Note>
          <BarChart
            className="mt-2"
            data={r.byMonth.map((p) => ({ ...p, value: Math.round(p.value / 100) }))}
            unit="rupees"
            formatValue={(rupees) => formatMoney(rupees * 100, r.currency)}
            onSelect={(i) => {
              const b = bucketRange("monthly", i, r.byMonth.length);
              router.push(links.orders({ status: "paid", from: b.from, to: b.to, mode: "live" }));
            }}
          />
        </div>
        <div>
          <p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">By plan, this period</p>
          <ul>
            {r.byPlan.map((p) => (
              <li key={p.label}>
                <StatRow
                  label={p.label}
                  value={
                    <>
                      {formatMoney(p.value, r.currency)}
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        {planTotal > 0 ? Math.round((p.value / planTotal) * 100) : 0}%
                      </span>
                    </>
                  }
                  href={links.orders({ status: "paid", from: range.from, to: range.to, plan: p.label, mode: "live" })}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </BlockCard>
  );
}

/* ---------------- orders that didn't complete ---------------- */

export function IncompleteOrdersBlock({ data, range }: BlockProps) {
  const o = data.incompleteOrders;
  const mounted = useMounted();
  return (
    <BlockCard
      title="Unfinished orders"
      icon={ReceiptText}
      href={links.orders({ status: "created,failed", from: range.from, to: range.to })}
      info="Orders that were started but never paid, and payments that failed. A sudden jump usually means a checkout problem, such as wrong gateway keys or a price."
    >
      <StatRow
        label="Started, never paid"
        value={formatCount(o.unpaid)}
        tone={o.unpaid > 0 ? "warn" : "good"}
        href={links.orders({ status: "created", from: range.from, to: range.to })}
      />
      <StatRow
        label="Payment failed"
        value={formatCount(o.failed)}
        tone={o.failed > 0 ? "bad" : "good"}
        href={links.orders({ status: "failed", from: range.from, to: range.to })}
      />
      <StatRow label="Last failure" value={mounted && o.lastFailedAt ? timeAgo(o.lastFailedAt) : o.lastFailedAt ? "…" : "None"} />
    </BlockCard>
  );
}
