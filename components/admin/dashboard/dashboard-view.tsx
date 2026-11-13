"use client";

// The admin dashboard: period switch, Needs attention, then the blocks in the
// admin's own order (BLOCKS in lib/admin/dashboard-model is the default). Edit
// dashboard lets them reorder and hide blocks.

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Check, FlaskConical, LayoutGrid, RotateCcw } from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { VizStyle } from "@/components/admin/ui/charts";
import { InfoTip } from "@/components/ui/info-tip";
import {
  BLOCKS,
  LAYOUT_COOKIE,
  blockLabel,
  defaultLayout,
  isDefaultLayout,
  periodRange,
  serializeLayout,
  type BlockId,
  type BlockSize,
  type DashboardData,
  type DashboardLayout,
  type PeriodSel,
} from "@/lib/admin/dashboard-model";
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
import { EditableGrid, HiddenTray } from "./editable-grid";
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

const SIZE = Object.fromEntries(BLOCKS.map((b) => [b.id, b.size])) as Record<BlockId, BlockSize>;
const spanOf = (id: BlockId) => SPAN[SIZE[id]];

/** Blocks that only make sense in some setups. */
function shown(id: BlockId, data: DashboardData): boolean {
  if (id === "gmail") return data.gmail.enabled;
  return true;
}

// PHASE 6 (UI first): the layout is kept in a cookie for now, so the server can
// draw the saved order with no jump on load. The database step moves it to a
// per-admin row that follows the admin across devices.
function saveLayout(l: DashboardLayout) {
  document.cookie = `${LAYOUT_COOKIE}=${encodeURIComponent(serializeLayout(l))}; path=/jmp-admin; max-age=31536000; samesite=lax`;
}

export function DashboardView({
  data,
  sel,
  layout: initialLayout,
  sample,
}: {
  data: DashboardData;
  sel: PeriodSel;
  layout: DashboardLayout;
  sample?: { quiet: boolean };
}) {
  const range = periodRange(sel);
  const [layout, setLayout] = useState(initialLayout);
  const [editing, setEditing] = useState(false);
  const change = (next: DashboardLayout) => {
    setLayout(next);
    saveLayout(next);
  };
  const visible = layout.order.filter((id) => shown(id, data) && !layout.hidden.includes(id));
  const hidden = layout.hidden.filter((id) => shown(id, data));
  const render = (id: BlockId) => {
    const Block = RENDER[id];
    return <Block data={data} range={range} />;
  };

  return (
    <div className="space-y-4">
      <VizStyle />
      {sample && <SampleBanner quiet={sample.quiet} />}
      <PeriodSwitch
        sel={sel}
        generatedAt={data.generatedAt}
        extra={
          !editing && (
            <Button variant="outline" size="sm" className="h-11 gap-1.5 sm:h-9" onClick={() => setEditing(true)}>
              <LayoutGrid className="size-4" aria-hidden />
              Edit dashboard
            </Button>
          )
        }
      />
      {editing && (
        <div className="sticky top-0 z-30 flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-card/95 px-3 py-2 shadow-sm backdrop-blur">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            Editing layout
            <InfoTip label="About editing the layout">
              Drag a block by its handle, or use the arrows. Hidden blocks wait at the bottom of the page. Needs attention always
              stays on top. Changes save as you go.
            </InfoTip>
          </p>
          <div className="ml-auto flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-11 gap-1.5 sm:h-9"
              disabled={isDefaultLayout(layout)}
              onClick={() => change(defaultLayout())}
            >
              <RotateCcw className="size-4" aria-hidden />
              Reset to default
            </Button>
            <Button size="sm" className="h-11 gap-1.5 sm:h-9" onClick={() => setEditing(false)}>
              <Check className="size-4" aria-hidden />
              Done
            </Button>
          </div>
        </div>
      )}
      <NeedsAttention items={data.attention} />
      {editing ? (
        <>
          <EditableGrid layout={layout} visible={visible} spanOf={spanOf} render={render} onChange={change} />
          <HiddenTray hidden={hidden} onShow={(id) => change({ ...layout, hidden: layout.hidden.filter((h) => h !== id) })} />
        </>
      ) : (
        <div className="grid grid-flow-row-dense grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-12">
          {visible.map((id) => (
            <section key={id} aria-label={blockLabel(id)} className={cn("min-w-0", spanOf(id))}>
              {render(id)}
            </section>
          ))}
        </div>
      )}
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
