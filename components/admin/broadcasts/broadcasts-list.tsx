"use client";

// Broadcasts: every message sent, scheduled or drafted, newest activity first.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Card } from "@/components/admin/ui/card";
import { buttonVariants } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { CategoryBadge, ChannelIcons, StatusBadge, selectCls } from "@/components/admin/broadcasts/broadcast-bits";
import { BROADCAST_STATUS_LABELS, type Broadcast, type BroadcastStatus } from "@/lib/broadcasts-model";
import { useMounted } from "@/lib/use-mounted";
import { cn, formatDateTime } from "@/lib/utils";

/** The one date that matters for each state. */
function when(b: Broadcast): string {
  switch (b.status) {
    case "scheduled":
      return `For ${formatDateTime(b.scheduledFor)}`;
    case "sending":
      return `Started ${formatDateTime(b.startedAt)}`;
    case "sent":
      return `Sent ${formatDateTime(b.startedAt)}`;
    case "canceled":
      return `Canceled ${formatDateTime(b.canceledAt)}`;
    default:
      return `Edited ${formatDateTime(b.updatedAt)}`;
  }
}

function reach(b: Broadcast): string {
  if (!b.delivery) return "";
  const parts = [];
  if (b.delivery.inApp) parts.push(`${b.delivery.inApp} in the app`);
  if (b.delivery.emailTotal) parts.push(`${b.delivery.emailSent} of ${b.delivery.emailTotal} emails`);
  return parts.join(" · ");
}

export function BroadcastsList({ broadcasts: raw }: { broadcasts: Broadcast[] }) {
  const mounted = useMounted();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<BroadcastStatus | "all">("all");

  const list = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return raw
      .filter((b) => status === "all" || b.status === status)
      .filter((b) => words.every((w) => b.title.toLowerCase().includes(w)));
  }, [raw, query, status]);

  const href = (b: Broadcast) => `/jmp-admin/broadcasts/${b.id}`;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full min-w-0 sm:w-auto sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search broadcasts…"
            aria-label="Search broadcasts"
            className="h-11 pl-8 sm:h-9"
          />
        </div>
        <select
          className={cn(selectCls, "w-auto min-w-0 flex-1 sm:flex-none")}
          value={status}
          onChange={(e) => setStatus(e.target.value as BroadcastStatus | "all")}
          aria-label="Filter by status"
        >
          <option value="all">Any status</option>
          {(Object.keys(BROADCAST_STATUS_LABELS) as BroadcastStatus[]).map((s) => (
            <option key={s} value={s}>
              {BROADCAST_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <Link href="/jmp-admin/broadcasts/new" className={cn(buttonVariants(), "ml-auto px-3")}>
          <Plus className="size-4" aria-hidden />
          New broadcast
        </Link>
      </div>

      {list.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {raw.length === 0 ? "No broadcasts yet." : "No broadcasts match."}
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-hidden p-0 lg:block">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-3 py-2.5 font-medium">Broadcast</th>
                  <th scope="col" className="w-32 px-3 py-2.5 font-medium">Category</th>
                  <th scope="col" className="w-28 px-3 py-2.5 font-medium">Status</th>
                  <th scope="col" className="w-56 px-3 py-2.5 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/40">
                    <td className="px-3 py-2.5">
                      <Link href={href(b)} className="flex min-w-0 items-center gap-2 font-medium hover:text-primary">
                        <ChannelIcons channel={b.channel} />
                        <span className="truncate">{b.title || "Untitled broadcast"}</span>
                      </Link>
                      {reach(b) && <p className="truncate text-xs text-muted-foreground">{reach(b)}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <CategoryBadge category={b.category} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{mounted ? when(b) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="divide-y p-0 lg:hidden">
            {list.map((b) => (
              <Link key={b.id} href={href(b)} className="block min-h-11 space-y-1.5 p-3 hover:bg-muted/40">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <ChannelIcons channel={b.channel} />
                  <span className="truncate">{b.title || "Untitled broadcast"}</span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <CategoryBadge category={b.category} />
                  <StatusBadge status={b.status} />
                </span>
                <span className="block text-xs text-muted-foreground">
                  {mounted ? when(b) : ""}
                  {reach(b) && ` · ${reach(b)}`}
                </span>
              </Link>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
