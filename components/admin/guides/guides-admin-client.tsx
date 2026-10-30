"use client";

// How-to guides (admin). A filterable table in the order users see it (stacked
// rows below lg, where the table wouldn't fit beside the sidebar). Keywords match
// the title, summary, link and guide text. Row actions: edit, activate / deactivate,
// move up / down, delete (confirmed). Data comes from the server page; each change
// goes through a Server Action, then router.refresh() re-reads.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ExternalLink, Pencil, Plus, Power, Search, Trash2 } from "lucide-react";
import { Card } from "@/components/admin/ui/card";
import { Button, buttonVariants } from "@/components/admin/ui/button";
import { Badge } from "@/components/admin/ui/badge";
import { Input } from "@/components/admin/ui/input";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import {
  deleteGuideAction,
  moveGuideAction,
  setGuideStatusAction,
} from "@/actions/admin-guides";
import type { GuideTopic } from "@/lib/guides-model";
import { guideIcon } from "@/lib/guide-icons";
import { useMounted } from "@/lib/use-mounted";
import { cn, formatDateTime } from "@/lib/utils";

const selectCls =
  "h-11 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none sm:h-9 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const htmlToText = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export function GuidesAdminClient({ topics }: { topics: GuideTopic[] }) {
  const router = useRouter();
  const mounted = useMounted();
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GuideTopic | null>(null);
  const [flash, setFlash] = useState("");
  const [flashErr, setFlashErr] = useState(false);
  const [query, setQuery] = useState("");
  const [fStatus, setFStatus] = useState<"all" | GuideTopic["status"]>("all");
  const [fProgress, setFProgress] = useState<"all" | "in_progress" | "complete">("all");

  const activeCount = topics.filter((t) => t.status === "active").length;
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

  function clearFilters() {
    setQuery("");
    setFStatus("all");
    setFProgress("all");
  }

  function say(msg: string, err = false) {
    setFlash(msg);
    setFlashErr(err);
    setTimeout(() => setFlash((m) => (m === msg ? "" : m)), 2800);
  }

  async function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) {
    setBusy(id);
    const res = await fn();
    setBusy(null);
    if (res.ok) {
      if (okMsg) say(okMsg);
      router.refresh();
    } else say(res.error ?? "Something went wrong.", true);
  }

  // Up / down swap with the neighbour in the full list, so they're off while filtered.
  const moveButtons = (t: GuideTopic, idx: number) => (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Move ${t.title} up`}
        title={filtering ? "Clear the filters to reorder" : "Move up"}
        disabled={busy === t.id || filtering || idx === 0}
        onClick={() => run(t.id, () => moveGuideAction(t.id, "up"))}
      >
        <ArrowUp className="size-4" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Move ${t.title} down`}
        title={filtering ? "Clear the filters to reorder" : "Move down"}
        disabled={busy === t.id || filtering || idx === topics.length - 1}
        onClick={() => run(t.id, () => moveGuideAction(t.id, "down"))}
      >
        <ArrowDown className="size-4" aria-hidden />
      </Button>
    </>
  );

  const rowActions = (t: GuideTopic, labelled: boolean) => {
    const live = t.status === "active";
    const rowBusy = busy === t.id;
    return (
      <>
        <Button
          variant={labelled ? "outline" : "ghost"}
          size={labelled ? "default" : "icon"}
          aria-label={`${live ? "Deactivate" : "Activate"} ${t.title}`}
          title={live ? "Deactivate" : "Activate"}
          disabled={rowBusy}
          onClick={() =>
            run(
              t.id,
              () => setGuideStatusAction(t.id, live ? "inactive" : "active"),
              live ? `“${t.title}” is hidden from users.` : `“${t.title}” is live.`,
            )
          }
        >
          <Power className={labelled ? "size-3.5" : "size-4"} aria-hidden />
          {labelled && (live ? "Deactivate" : "Activate")}
        </Button>
        <Link
          href={`/jmp-admin/guides/${t.id}`}
          aria-label={`Edit ${t.title}`}
          title="Edit"
          className={cn(buttonVariants(labelled ? { variant: "outline" } : { variant: "ghost", size: "icon" }))}
        >
          <Pencil className={labelled ? "size-3.5" : "size-4"} aria-hidden />
          {labelled && "Edit"}
        </Link>
        {live && (
          <a
            href={`/guides?topic=${t.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${t.title} on the site`}
            title="View on site"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
          >
            <ExternalLink className="size-4" aria-hidden />
          </a>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${t.title}`}
          title="Delete"
          disabled={rowBusy}
          onClick={() => setDeleteTarget(t)}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </>
    );
  };

  const statusBadges = (t: GuideTopic) => (
    <>
      <Badge variant={t.status === "active" ? "success" : "neutral"}>{t.status === "active" ? "Active" : "Inactive"}</Badge>
      {t.inProgress && <Badge variant="warning">In progress</Badge>}
    </>
  );

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {topics.length} {topics.length === 1 ? "guide" : "guides"} · {activeCount} live
        </p>
        <Link href="/jmp-admin/guides/new" className={cn(buttonVariants(), "px-3")}>
          <Plus className="size-4" aria-hidden />
          Add guide
        </Link>
      </div>

      {flash && (
        <p
          role="status"
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            flashErr ? "bg-destructive/10 text-destructive" : "bg-status-applied text-status-applied-foreground",
          )}
        >
          {flash}
        </p>
      )}

      {topics.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No guides yet.{" "}
          <Link href="/jmp-admin/guides/new" className="font-medium text-primary hover:underline">
            Add the first one
          </Link>
          .
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full min-w-0 sm:w-auto sm:flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title, link, guide text…"
                aria-label="Search guides by keyword"
                className="h-11 pl-8 sm:h-9"
              />
            </div>
            <select className={selectCls} value={fStatus} onChange={(e) => setFStatus(e.target.value as typeof fStatus)} aria-label="Filter status">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select className={selectCls} value={fProgress} onChange={(e) => setFProgress(e.target.value as typeof fProgress)} aria-label="Filter progress">
              <option value="all">All progress</option>
              <option value="in_progress">In progress</option>
              <option value="complete">Complete</option>
            </select>
            {filtering && (
              <>
                <Button variant="ghost" onClick={clearFilters}>Clear</Button>
                <span className="ml-auto text-sm text-muted-foreground">
                  {filtered.length} of {topics.length}
                </span>
              </>
            )}
          </div>

          {filtered.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">No guides match these filters.</Card>
          ) : (
            <>
              {/* Laptops and up: table */}
              <Card className="hidden overflow-hidden p-0 lg:block">
                <table className="w-full table-fixed text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th scope="col" className="w-20 px-2 py-2.5 text-center font-medium">Order</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Guide</th>
                      <th scope="col" className="w-44 px-3 py-2.5 font-medium">Status</th>
                      <th scope="col" className="hidden w-16 px-3 py-2.5 text-right font-medium xl:table-cell">Words</th>
                      <th scope="col" className="hidden w-44 px-3 py-2.5 font-medium xl:table-cell">Updated</th>
                      <th scope="col" className="w-40 px-3 py-2.5 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map(({ t, idx, words }) => (
                      <tr key={t.id} className={cn(busy === t.id && "opacity-60")}>
                        <td className="px-2 py-2.5">
                          <div className="flex justify-center">{moveButtons(t, idx)}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex min-w-0 items-center gap-3">
                            {guideIconBox(t)}
                            <div className="min-w-0">
                              <Link href={`/jmp-admin/guides/${t.id}`} className="block truncate font-medium hover:text-primary">
                                {t.title}
                              </Link>
                              <p className="truncate text-xs text-muted-foreground">/guides?topic={t.slug}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">{statusBadges(t)}</div>
                        </td>
                        <td className="hidden px-3 py-2.5 text-right tabular-nums xl:table-cell">{words}</td>
                        <td className="hidden px-3 py-2.5 text-xs text-muted-foreground xl:table-cell">
                          {mounted ? formatDateTime(t.updatedAt) : ""}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-end">{rowActions(t, false)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              {/* Phones and tablets: stacked rows */}
              <Card className="divide-y p-0 lg:hidden">
                {filtered.map(({ t, idx, words }) => (
                  <div key={t.id} className={cn("space-y-3 p-3", busy === t.id && "opacity-60")}>
                    <div className="flex min-w-0 items-start gap-3">
                      {guideIconBox(t)}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link href={`/jmp-admin/guides/${t.id}`} className="truncate text-sm font-medium hover:text-primary">
                            {t.title}
                          </Link>
                          {statusBadges(t)}
                        </div>
                        <p className="mt-0.5 text-xs break-words text-muted-foreground">
                          /guides?topic={t.slug} · {words} {words === 1 ? "word" : "words"}
                          {mounted ? ` · updated ${formatDateTime(t.updatedAt)}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {moveButtons(t, idx)}
                      {rowActions(t, true)}
                    </div>
                  </div>
                ))}
              </Card>
            </>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete “${deleteTarget?.title ?? ""}”?`}
        description="The guide and all its content are removed for good. To hide it for now, deactivate it instead."
        confirmLabel="Delete guide"
        destructive
        onConfirm={async () => {
          const t = deleteTarget;
          setDeleteTarget(null);
          if (t) await run(t.id, () => deleteGuideAction(t.id), `Deleted “${t.title}”.`);
        }}
      />
    </div>
  );
}
