"use client";

// Broadcasts: every message sent, scheduled or drafted, newest activity first.
// Table at every width with multi-select, an Action menu per row and paging
// (components/admin/ui/data-table.tsx). Not an activity log, so no date range:
// a 7-day window would hide scheduled sends and older drafts.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Copy, ExternalLink, Plus, Search, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { toast } from "@/components/admin/ui/toast";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/admin/ui/dropdown-menu";
import {
  BulkBar,
  RowActions,
  RowCheckbox,
  SelectAllCheckbox,
  TableBox,
  TablePagination,
  usePagination,
  useRowSelection,
} from "@/components/admin/ui/data-table";
import { CategoryBadge, ChannelIcons, StatusBadge, selectCls } from "@/components/admin/broadcasts/broadcast-bits";
import { BROADCAST_STATUS_LABELS, type Broadcast, type BroadcastStatus } from "@/lib/broadcasts-model";
import { cancelBroadcastAction, deleteBroadcastAction, duplicateBroadcastAction } from "@/actions/admin-broadcasts";
import { useMounted } from "@/lib/use-mounted";
import { pick, useInitialQuery, useQuerySync } from "@/lib/admin/url-filters";
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

/** Mirrors the server rules in actions/admin-broadcasts.ts. */
const canCancel = (b: Broadcast) => b.status === "scheduled" || b.status === "sending";
const canDelete = (b: Broadcast) => b.status === "draft" || (b.status === "canceled" && !b.startedAt);

type Pending = { kind: "cancel" | "delete"; items: Broadcast[] } | null;

export function BroadcastsList({ broadcasts: raw }: { broadcasts: Broadcast[] }) {
  const mounted = useMounted();
  const router = useRouter();
  // ?status=&q= in the link (dashboard, bookmarks), kept in step as they change.
  const sp = useInitialQuery();
  const [query, setQuery] = useState(sp.get("q") ?? "");
  const [status, setStatus] = useState<BroadcastStatus | "all">(() =>
    pick(sp.get("status"), ["all", ...(Object.keys(BROADCAST_STATUS_LABELS) as BroadcastStatus[])], "all"),
  );
  useQuerySync({ q: query.trim(), status }, { status: "all" });
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return raw
      .filter((b) => status === "all" || b.status === status)
      .filter((b) => words.every((w) => b.title.toLowerCase().includes(w)));
  }, [raw, query, status]);

  const selection = useRowSelection(list.map((b) => b.id));
  const paging = usePagination(list, `${query}|${status}`);
  const chosen = list.filter((b) => selection.isSelected(b.id));
  const href = (b: Broadcast) => `/jmp-admin/broadcasts/${b.id}`;

  async function duplicate(b: Broadcast) {
    const res = await duplicateBroadcastAction(b.id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Copied as a new draft");
    router.push(`/jmp-admin/broadcasts/${res.id}`);
  }

  async function run() {
    if (!pending) return;
    const { kind, items } = pending;
    setPending(null);
    setBusy(true);
    let done = 0;
    let firstError = "";
    for (const b of items) {
      const res = kind === "cancel" ? await cancelBroadcastAction(b.id) : await deleteBroadcastAction(b.id);
      if (res.ok) done++;
      else firstError ||= res.error;
    }
    setBusy(false);
    const verb = kind === "cancel" ? "Canceled" : "Deleted";
    if (done) toast.success(`${verb} ${done} broadcast${done === 1 ? "" : "s"}`);
    if (firstError) toast.error(firstError);
    selection.clear();
    router.refresh();
  }

  const bulkCancel = chosen.filter(canCancel);
  const bulkDelete = chosen.filter(canDelete);

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

      <BulkBar selection={selection}>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || bulkCancel.length === 0}
          onClick={() => setPending({ kind: "cancel", items: bulkCancel })}
        >
          <Ban className="size-4" /> Cancel{bulkCancel.length ? ` (${bulkCancel.length})` : ""}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={busy || bulkDelete.length === 0}
          onClick={() => setPending({ kind: "delete", items: bulkDelete })}
        >
          <Trash2 className="size-4" /> Delete{bulkDelete.length ? ` (${bulkDelete.length})` : ""}
        </Button>
      </BulkBar>

      <TableBox minWidth={760}>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="w-10 px-3 py-2.5">
              <SelectAllCheckbox selection={selection} />
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">Broadcast</th>
            <th scope="col" className="w-32 px-3 py-2.5 font-medium">Category</th>
            <th scope="col" className="w-28 px-3 py-2.5 font-medium">Status</th>
            <th scope="col" className="w-56 px-3 py-2.5 font-medium">When</th>
            <th scope="col" className="w-20 px-3 py-2.5 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {paging.paged.map((b) => (
            <tr key={b.id} className={cn("hover:bg-muted/40", selection.isSelected(b.id) && "bg-primary/5")}>
              <td className="px-3 py-3">
                <RowCheckbox selection={selection} id={b.id} label={b.title || "Untitled broadcast"} />
              </td>
              <td className="min-w-[240px] px-3 py-2.5">
                <Link href={href(b)} className="flex min-w-0 items-center gap-2 font-medium hover:text-primary">
                  <ChannelIcons channel={b.channel} />
                  <span className="line-clamp-2">{b.title || "Untitled broadcast"}</span>
                </Link>
                {reach(b) && <p className="line-clamp-1 text-xs text-muted-foreground">{reach(b)}</p>}
              </td>
              <td className="px-3 py-2.5">
                <CategoryBadge category={b.category} />
              </td>
              <td className="px-3 py-2.5">
                <StatusBadge status={b.status} />
              </td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">{mounted ? when(b) : ""}</td>
              <td className="px-3 py-2 text-right">
                <RowActions label={b.title || "Untitled broadcast"}>
                  <DropdownMenuItem onClick={() => router.push(href(b))}>
                    <ExternalLink /> Open
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => duplicate(b)}>
                    <Copy /> Duplicate
                  </DropdownMenuItem>
                  {canCancel(b) && (
                    <DropdownMenuItem onClick={() => setPending({ kind: "cancel", items: [b] })}>
                      <Ban /> Cancel send
                    </DropdownMenuItem>
                  )}
                  {canDelete(b) && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive onClick={() => setPending({ kind: "delete", items: [b] })}>
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </RowActions>
              </td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                {raw.length === 0 ? "No broadcasts yet." : "No broadcasts match."}
              </td>
            </tr>
          )}
        </tbody>
      </TableBox>

      <TablePagination paging={paging} />

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={
          pending?.kind === "cancel"
            ? `Cancel ${pending.items.length === 1 ? "this broadcast" : `${pending.items.length} broadcasts`}?`
            : `Delete ${pending?.items.length === 1 ? "this broadcast" : `${pending?.items.length ?? 0} broadcasts`}?`
        }
        description={
          pending?.kind === "cancel"
            ? "Emails still waiting won't go out. Anything already delivered stays delivered."
            : "This can't be undone. Only drafts and sends canceled before they started are deleted."
        }
        confirmLabel={pending?.kind === "cancel" ? "Cancel send" : "Delete"}
        destructive
        onConfirm={run}
      />
    </div>
  );
}
