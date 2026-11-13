"use client";

// The admin dashboard: period switch, Needs attention, then the blocks in the
// order of BLOCKS (lib/admin/dashboard-model). Phase 6 lets each admin reorder
// and hide blocks; the registry and sizes below are already shaped for that.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { VizStyle } from "@/components/admin/ui/charts";
import { BLOCKS, periodRange, type BlockId, type BlockSize, type DashboardData, type PeriodSel } from "@/lib/admin/dashboard-model";
import { cn } from "@/lib/utils";
import {
  ActiveUsersBlock,
  FunnelBlock,
  IncompleteOrdersBlock,
  NewUsersBlock,
  PaidUsersTile,
  PlansBlock,
  RevenueBlock,
  RevenueTile,
  SignedInTile,
  TotalUsersTile,
  type BlockProps,
} from "./blocks-growth";
import {
  BroadcastsBlock,
  EmailDeliveryBlock,
  ForwardingBlock,
  GmailBlock,
  RenewalsBlock,
  SupportBlock,
  SystemBlock,
} from "./blocks-ops";
import { NeedsAttention } from "./needs-attention";
import { PeriodSwitch } from "./period-switch";

const RENDER: Record<BlockId, (p: BlockProps) => React.ReactNode> = {
  "tile-users": TotalUsersTile,
  "tile-signed-in": SignedInTile,
  "tile-paid": PaidUsersTile,
  "tile-revenue": RevenueTile,
  "new-users": NewUsersBlock,
  plans: PlansBlock,
  revenue: RevenueBlock,
  "incomplete-orders": IncompleteOrdersBlock,
  "active-users": ActiveUsersBlock,
  funnel: FunnelBlock,
  support: SupportBlock,
  renewals: RenewalsBlock,
  forwarding: ForwardingBlock,
  "email-delivery": EmailDeliveryBlock,
  broadcasts: BroadcastsBlock,
  gmail: GmailBlock,
  system: SystemBlock,
};

// Phone: one column. Tablet: tiles two to a row, everything else full width
// (the sidebar leaves ~500px). Small laptop: two columns. Wide screens: a
// 12-column grid.
const SPAN: Record<BlockSize, string> = {
  tile: "xl:col-span-3",
  third: "sm:col-span-2 lg:col-span-1 xl:col-span-4",
  half: "sm:col-span-2 xl:col-span-6",
  wide: "sm:col-span-2 xl:col-span-8",
  full: "sm:col-span-2 xl:col-span-12",
};

/** Blocks that only make sense in some setups. */
function shown(id: BlockId, data: DashboardData): boolean {
  if (id === "gmail") return data.gmail.enabled;
  return true;
}

export function DashboardView({ data, sel, sample }: { data: DashboardData; sel: PeriodSel; sample?: { quiet: boolean } }) {
  const range = periodRange(sel);
  const blocks = BLOCKS.filter((b) => shown(b.id, data));
  return (
    <div className="space-y-4">
      <VizStyle />
      {sample && <SampleBanner quiet={sample.quiet} />}
      <PeriodSwitch sel={sel} generatedAt={data.generatedAt} />
      <NeedsAttention items={data.attention} />
      <div className="grid grid-flow-row-dense grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-12">
        {blocks.map((b) => {
          const Block = RENDER[b.id];
          return (
            <section key={b.id} aria-label={b.title} className={cn("min-w-0", SPAN[b.size])}>
              <Block data={data} range={range} />
            </section>
          );
        })}
      </div>
    </div>
  );
}

// PHASE 1 ONLY: says the numbers are made up, and flips between a busy and a
// quiet day so both states can be reviewed. Removed in phase 3.
function SampleBanner({ quiet }: { quiet: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const sp = new URLSearchParams(params.toString());
  if (quiet) sp.delete("sample");
  else sp.set("sample", "quiet");
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-sm">
      <FlaskConical className="size-4 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1">Sample data. Real numbers arrive in a later phase.</span>
      <Link href={`${pathname}?${sp.toString()}`} scroll={false} className="inline-flex min-h-11 items-center text-xs font-medium text-primary hover:underline">
        {quiet ? "Show a busy day" : "Show a quiet day"}
      </Link>
    </div>
  );
}
