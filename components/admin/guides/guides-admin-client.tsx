"use client";

// How-to guides (admin). A table at every width, in the order users see it.
// Keywords match the title, summary, link and guide text. Stat boxes filter;
// multi-select activates, deactivates or deletes (confirmed); the Action menu
// edits, toggles, opens on the site or deletes; the Order column moves a guide
// up/down (off while filtered, since moves swap with the neighbour in the full
// list). Each change goes through a Server Action, then router.refresh().

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ExternalLink, Pencil, Plus, Power, Search, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/admin/ui/button";
import { Badge } from "@/components/admin/ui/badge";
import { Input } from "@/components/admin/ui/input";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { toast } from "@/components/admin/ui/toast";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/admin/ui/dropdown-menu";
import {
  BulkBar,
  RowActions,
  RowCheckbox,
  SelectAllCheckbox,
  StatBox,
  TableBox,
  TablePagination,
  tableSelectCls,
  usePagination,
  useRowSelection,
} from "@/components/admin/ui/data-table";
import { deleteGuideAction, moveGuideAction, setGuideStatusAction } from "@/actions/admin-guides";
import type { GuideTopic } from "@/lib/guides-model";
import { guideIcon } from "@/lib/guide-icons";
import { useMounted } from "@/lib/use-mounted";
import { cn, formatDateTime } from "@/lib/utils";

const htmlToText = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

type StatusFilter = "all" | GuideTopic["status"];
type ProgressFilter = "all" | "in_progress" | "complete";

export function GuidesAdminClient({ topics }: { topics: GuideTopic[] }) {
  const router = useRouter();
  const mounted = useMounted();
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<GuideTopic[] | null>(null);
  const [query, setQuery] = useState("");
  const [fStatus, setFStatus] = useState<StatusFilter>("all");
  const [fProgress, setFProgress] = useState<ProgressFilter>("all");

  const filtering = query.trim() !== "" || fStatus !== "all" || fProgress !== "all";

  const rows = useMemo(
    () =>
      topics.map((t, idx) => {
        const text = htmlToText(t.contentHtml);
        return {
          t,
          idx,
          words: text ? text.split(" ").length : 0,
          haystack: `${t.title} ${t.summary} ${t.slug} ${text}`.toLowerCase(),
        };
      }),
    [topics],
  );

  // Every keyword must match, in any order.
  const filtered = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter(
      ({ t, haystack }) =>
        (fStatus === "all" || t.status === fStatus) &&
        (fProgress === "all" || t.inProgress === (fProgress === "in_progress")) &&
        words.every((w) => haystack.includes(w)),
    );
  }, [rows, query, fStatus, fProgress]);

  const selection = useRowSelection(filtered.map((r) => r.t.id));
  const paging = usePagination(filtered, `${query}|${fStatus}|${fProgress}`);
  const chosen = filtered.filter((r) => selection.isSelected(r.t.id)).map((r) => r.t);

  async function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) {
    setBusy(id);
    const res = await fn();
    setBusy(null);
    if (res.ok) {
      if (okMsg) toast.success(okMsg);
      router.refresh();
    } else toast.error(res.error ?? "Something went wrong.");
  }

  async function bulk(list: GuideTopic[], fn: (t: GuideTopic) => Promise<{ ok: boolean; error?: string }>, verb: string) {
    setBusy("bulk");
    let done = 0;
    let firstError = "";
    for (const t of list) {
      const res = await fn(t);
      if (res.ok) done++;
      else firstError ||= res.error ?? "Something went wrong.";
    }
    setBusy(null);
    if (done) toast.success(`${verb} ${done} ${done === 1 ? "guide" : "guides"}.`);
    if (firstError) toast.error(firstError);
    selection.clear();
    router.refresh();
  }

  const live = topics.filter((t) => t.status === "active").length;
  const stats: { label: string; value: number; active: boolean; onClick: () => void }[] = [
    {
      label: "All guides",
      value: topics.length,
      active: !filtering,
      onClick: () => {
        setQuery("");
        setFStatus("all");
        setFProgress("all");
      },
    },
    { label: "Live", value: live, active: fStatus === "active", onClick: () => setFStatus(fStatus === "active" ? "all" : "active") },
    {
      label: "Inactive",
      value: topics.length - live,
      active: fStatus === "inactive",
      onClick: () => setFStatus(fStatus === "inactive" ? "all" : "inactive"),
    },
    {
      label: "In progress",
      value: topics.filter((t) => t.inProgress).length,
      active: fProgress === "in_progress",
      onClick: () => setFProgress(fProgress === "in_progress" ? "all" : "in_progress"),
    },
  ];

  const guideIconBox = (t: GuideTopic) => {
    const Icon = guideIcon(t.icon);
    return (
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          t.status === "active" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <StatBox key={s.label} label={s.label} value={String(s.value)} active={s.active} onClick={s.onClick} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full min-w-0 sm:w-auto sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, link, guide text…"
            aria-label="Search guides by keyword"
            className="h-11 pl-8 sm:h-9"
          />
        </div>
        <select className={tableSelectCls} value={fStatus} onChange={(e) => setFStatus(e.target.value as StatusFilter)} aria-label="Filter status">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select className={tableSelectCls} value={fProgress} onChange={(e) => setFProgress(e.target.value as ProgressFilter)} aria-label="Filter progress">
          <option value="all">All progress</option>
          <option value="in_progress">In progress</option>
          <option value="complete">Complete</option>
        </select>
        <Link href="/jmp-admin/guides/new" className={cn(buttonVariants(), "ml-auto px-3")}>
          <Plus className="size-4" aria-hidden />
          Add guide
        </Link>
      </div>

      <BulkBar selection={selection}>
        <Button variant="outline" size="sm" disabled={!!busy} onClick={() => bulk(chosen.filter((t) => t.status !== "active"), (t) => setGuideStatusAction(t.id, "active"), "Activated")}>
          <Power className="size-4" /> Activate
        </Button>
        <Button variant="outline" size="sm" disabled={!!busy} onClick={() => bulk(chosen.filter((t) => t.status === "active"), (t) => setGuideStatusAction(t.id, "inactive"), "Deactivated")}>
          <Power className="size-4" /> Deactivate
        </Button>
        <Button variant="destructive" size="sm" disabled={!!busy} onClick={() => setDeleteTargets(chosen)}>
          <Trash2 className="size-4" /> Delete
        </Button>
      </BulkBar>

      <TableBox minWidth={820}>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="w-10 px-3 py-2.5">
              <SelectAllCheckbox selection={selection} />
            </th>
            <th scope="col" className="w-24 px-2 py-2.5 text-center font-medium">Order</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Guide</th>
            <th scope="col" className="w-40 px-3 py-2.5 font-medium">Status</th>
            <th scope="col" className="w-20 px-3 py-2.5 text-right font-medium">Words</th>
            <th scope="col" className="w-44 px-3 py-2.5 font-medium">Updated</th>
            <th scope="col" className="w-20 px-3 py-2.5 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {paging.paged.map(({ t, idx, words }) => {
            const isLive = t.status === "active";
            return (
              <tr key={t.id} className={cn("hover:bg-muted/40", busy === t.id && "opacity-60", selection.isSelected(t.id) && "bg-primary/5")}>
                <td className="px-3 py-3">
                  <RowCheckbox selection={selection} id={t.id} label={t.title} />
                </td>
                <td className="px-2 py-2">
                  <div className="flex justify-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${t.title} up`}
                      title={filtering ? "Clear the filters to reorder" : "Move up"}
                      disabled={!!busy || filtering || idx === 0}
                      onClick={() => run(t.id, () => moveGuideAction(t.id, "up"))}
                    >
                      <ArrowUp className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${t.title} down`}
                      title={filtering ? "Clear the filters to reorder" : "Move down"}
                      disabled={!!busy || filtering || idx === topics.length - 1}
                      onClick={() => run(t.id, () => moveGuideAction(t.id, "down"))}
                    >
                      <ArrowDown className="size-4" aria-hidden />
                    </Button>
                  </div>
                </td>
                <td className="min-w-[240px] px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    {guideIconBox(t)}
                    <div className="min-w-0">
                      <Link href={`/jmp-admin/guides/${t.id}`} className="line-clamp-2 font-medium hover:text-primary">
                        {t.title}
                      </Link>
                      <p className="line-clamp-1 text-xs break-all text-muted-foreground">/guides?topic={t.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={isLive ? "success" : "neutral"}>{isLive ? "Active" : "Inactive"}</Badge>
                    {t.inProgress && <Badge variant="warning">In progress</Badge>}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{words}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{mounted ? formatDateTime(t.updatedAt) : ""}</td>
                <td className="px-3 py-2 text-right">
                  <RowActions label={t.title}>
                    <DropdownMenuItem onClick={() => router.push(`/jmp-admin/guides/${t.id}`)}>
                      <Pencil /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        run(
                          t.id,
                          () => setGuideStatusAction(t.id, isLive ? "inactive" : "active"),
                          isLive ? `“${t.title}” is hidden from users.` : `“${t.title}” is live.`,
                        )
                      }
                    >
                      <Power /> {isLive ? "Deactivate" : "Activate"}
                    </DropdownMenuItem>
                    {isLive && (
                      <DropdownMenuItem onClick={() => window.open(`/guides?topic=${t.slug}`, "_blank", "noopener,noreferrer")}>
                        <ExternalLink /> View on site
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onClick={() => setDeleteTargets([t])}>
                      <Trash2 /> Delete
                    </DropdownMenuItem>
                  </RowActions>
                </td>
              </tr>
            );
          })}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                {topics.length === 0 ? (
                  <>
                    No guides yet.{" "}
                    <Link href="/jmp-admin/guides/new" className="font-medium text-primary hover:underline">
                      Add the first one
                    </Link>
                    .
                  </>
                ) : (
                  "No guides match these filters."
                )}
              </td>
            </tr>
          )}
        </tbody>
      </TableBox>

      <TablePagination paging={paging} />

      <ConfirmDialog
        open={!!deleteTargets}
        onOpenChange={(o) => !o && setDeleteTargets(null)}
        title={
          deleteTargets?.length === 1
            ? `Delete “${deleteTargets[0].title}”?`
            : `Delete ${deleteTargets?.length ?? 0} guides?`
        }
        description="Guides and all their content are removed for good. To hide a guide for now, deactivate it instead."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          const list = deleteTargets ?? [];
          setDeleteTargets(null);
          if (list.length === 1) await run(list[0].id, () => deleteGuideAction(list[0].id), `Deleted “${list[0].title}”.`);
          else if (list.length) await bulk(list, (t) => deleteGuideAction(t.id), "Deleted");
        }}
      />
    </div>
  );
}
