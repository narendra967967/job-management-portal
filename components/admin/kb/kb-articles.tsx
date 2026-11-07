"use client";

// Knowledge base articles: a table at every width. Keywords match the title,
// summary, keywords and article text. Stat boxes filter; multi-select
// publishes, unpublishes or deletes (articles written here only: repo
// articles come from docs/knowledge-base and are view-only, "Sync from repo"
// reloads them); the Action menu views, edits, toggles or deletes.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, FolderGit2, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
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
import { deleteKbArticleAction, setKbArticleStatusAction, syncKbAction } from "@/actions/admin-kb";
import { KB_CATEGORIES, kbHtmlToText, type KbArticle } from "@/lib/kb-model";
import { useMounted } from "@/lib/use-mounted";
import { cn, formatDateTime } from "@/lib/utils";

type StatusFilter = "all" | KbArticle["status"];
type SourceFilter = "all" | KbArticle["source"];

export function KbArticles({ articles }: { articles: KbArticle[] }) {
  const router = useRouter();
  const mounted = useMounted();
  const [query, setQuery] = useState("");
  const [fCategory, setFCategory] = useState("all");
  const [fStatus, setFStatus] = useState<StatusFilter>("all");
  const [fSource, setFSource] = useState<SourceFilter>("all");
  const [deleteTargets, setDeleteTargets] = useState<KbArticle[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const filtering = query.trim() !== "" || fCategory !== "all" || fStatus !== "all" || fSource !== "all";

  const rows = useMemo(
    () =>
      articles.map((a) => ({
        a,
        hay: `${a.title} ${a.summary} ${a.keywords.join(" ")} ${a.slug} ${kbHtmlToText(a.contentHtml)}`.toLowerCase(),
      })),
    [articles],
  );
  const filtered = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return rows
      .filter(
        ({ a, hay }) =>
          (fCategory === "all" || a.category === fCategory) &&
          (fStatus === "all" || a.status === fStatus) &&
          (fSource === "all" || a.source === fSource) &&
          words.every((w) => hay.includes(w)),
      )
      .map(({ a }) => a);
  }, [rows, query, fCategory, fStatus, fSource]);

  const selection = useRowSelection(filtered.map((a) => a.id));
  const paging = usePagination(filtered, `${query}|${fCategory}|${fStatus}|${fSource}`);
  // Bulk actions only touch articles written here; repo articles are view-only.
  const editable = filtered.filter((a) => selection.isSelected(a.id) && a.source !== "repo");

  async function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    setBusy(id);
    const res = await fn();
    setBusy(null);
    if (res.ok) {
      toast.success(okMsg);
      router.refresh();
    } else toast.error(res.error ?? "Something went wrong.");
  }

  async function bulk(list: KbArticle[], fn: (a: KbArticle) => Promise<{ ok: boolean; error?: string }>, verb: string) {
    setBusy("bulk");
    let done = 0;
    let firstError = "";
    for (const a of list) {
      const res = await fn(a);
      if (res.ok) done++;
      else firstError ||= res.error ?? "Something went wrong.";
    }
    setBusy(null);
    if (done) toast.success(`${verb} ${done} ${done === 1 ? "article" : "articles"}.`);
    if (firstError) toast.error(firstError);
    selection.clear();
    router.refresh();
  }

  async function sync() {
    setBusy("sync");
    const res = await syncKbAction();
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    const { added, updated, removed, unchanged, errors } = res.result;
    const changed = added + updated + removed;
    const parts = [added && `${added} added`, updated && `${updated} updated`, removed && `${removed} removed`].filter(Boolean);
    if (errors.length) {
      toast.error(`${errors.length} ${errors.length === 1 ? "file has" : "files have"} a problem: ${errors.map((e) => `${e.file} (${e.error})`).join("; ")}`);
    }
    if (changed) toast.success(`Synced: ${parts.join(", ")}.`);
    else if (!errors.length) toast.success(`Already up to date (${unchanged} ${unchanged === 1 ? "file" : "files"}).`);
    router.refresh();
  }

  const count = (fn: (a: KbArticle) => boolean) => articles.filter(fn).length;
  const toggle = <T extends string>(cur: T, val: T, set: (v: T) => void, all: T) => set(cur === val ? all : val);
  const stats = [
    {
      label: "All articles",
      value: articles.length,
      active: !filtering,
      onClick: () => {
        setQuery("");
        setFCategory("all");
        setFStatus("all");
        setFSource("all");
      },
    },
    { label: "Published", value: count((a) => a.status === "published"), active: fStatus === "published", onClick: () => toggle<StatusFilter>(fStatus, "published", setFStatus, "all") },
    { label: "Drafts", value: count((a) => a.status === "draft"), active: fStatus === "draft", onClick: () => toggle<StatusFilter>(fStatus, "draft", setFStatus, "all") },
    { label: "From repo", value: count((a) => a.source === "repo"), active: fSource === "repo", onClick: () => toggle<SourceFilter>(fSource, "repo", setFSource, "all") },
    { label: "Written here", value: count((a) => a.source === "admin"), active: fSource === "admin", onClick: () => toggle<SourceFilter>(fSource, "admin", setFSource, "all") },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s, i) => (
          <StatBox
            key={s.label}
            label={s.label}
            value={String(s.value)}
            active={s.active}
            onClick={s.onClick}
            className={i === 0 ? "col-span-2 sm:col-span-1" : undefined}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full min-w-0 sm:w-auto sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, keywords, text…"
            aria-label="Search articles"
            className="h-11 pl-8 sm:h-9"
          />
        </div>
        <select className={tableSelectCls} value={fCategory} onChange={(e) => setFCategory(e.target.value)} aria-label="Filter category">
          <option value="all">All categories</option>
          {KB_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select className={tableSelectCls} value={fStatus} onChange={(e) => setFStatus(e.target.value as StatusFilter)} aria-label="Filter status">
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <select className={tableSelectCls} value={fSource} onChange={(e) => setFSource(e.target.value as SourceFilter)} aria-label="Filter source">
          <option value="all">All sources</option>
          <option value="repo">Repo</option>
          <option value="admin">Written here</option>
        </select>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" onClick={sync} disabled={busy === "sync"}>
            <RefreshCw className={cn("size-4", busy === "sync" && "animate-spin")} aria-hidden />
            Sync from repo
          </Button>
          <Link href="/jmp-admin/knowledge-base/articles/new" className={cn(buttonVariants(), "px-3")}>
            <Plus className="size-4" aria-hidden />
            Add article
          </Link>
        </div>
      </div>

      <BulkBar selection={selection}>
        <Button
          variant="outline"
          size="sm"
          disabled={!!busy || !editable.some((a) => a.status === "draft")}
          onClick={() => bulk(editable.filter((a) => a.status === "draft"), (a) => setKbArticleStatusAction(a.id, "published"), "Published")}
        >
          <Eye className="size-4" /> Publish
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!!busy || !editable.some((a) => a.status === "published")}
          onClick={() => bulk(editable.filter((a) => a.status === "published"), (a) => setKbArticleStatusAction(a.id, "draft"), "Unpublished")}
        >
          <EyeOff className="size-4" /> Unpublish
        </Button>
        <Button variant="destructive" size="sm" disabled={!!busy || editable.length === 0} onClick={() => setDeleteTargets(editable)}>
          <Trash2 className="size-4" /> Delete{editable.length ? ` (${editable.length})` : ""}
        </Button>
      </BulkBar>

      <TableBox minWidth={820}>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="w-10 px-3 py-2.5">
              <SelectAllCheckbox selection={selection} />
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">Article</th>
            <th scope="col" className="w-44 px-3 py-2.5 font-medium">Category</th>
            <th scope="col" className="w-40 px-3 py-2.5 font-medium">Status</th>
            <th scope="col" className="w-44 px-3 py-2.5 font-medium">Updated</th>
            <th scope="col" className="w-20 px-3 py-2.5 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {paging.paged.map((a) => {
            const isRepo = a.source === "repo";
            const live = a.status === "published";
            const href = `/jmp-admin/knowledge-base/articles/${a.id}`;
            return (
              <tr key={a.id} className={cn("hover:bg-muted/40", busy === a.id && "opacity-60", selection.isSelected(a.id) && "bg-primary/5")}>
                <td className="px-3 py-3">
                  <RowCheckbox selection={selection} id={a.id} label={a.title} />
                </td>
                <td className="min-w-[260px] px-3 py-2.5">
                  <Link href={href} className="line-clamp-2 font-medium hover:text-primary">
                    {a.title}
                  </Link>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{a.summary}</p>
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.category}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={live ? "success" : "neutral"}>{live ? "Published" : "Draft"}</Badge>
                    {isRepo && (
                      <Badge variant="neutral" className="gap-1">
                        <FolderGit2 className="size-3" aria-hidden />
                        Repo
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{mounted ? formatDateTime(a.updatedAt) : ""}</td>
                <td className="px-3 py-2 text-right">
                  <RowActions label={a.title}>
                    {isRepo ? (
                      <DropdownMenuItem onClick={() => router.push(href)}>
                        <Eye /> View
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem onClick={() => router.push(href)}>
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            run(
                              a.id,
                              () => setKbArticleStatusAction(a.id, live ? "draft" : "published"),
                              live ? `“${a.title}” is back to draft.` : `“${a.title}” is published.`,
                            )
                          }
                        >
                          {live ? <EyeOff /> : <Eye />} {live ? "Unpublish" : "Publish"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem destructive onClick={() => setDeleteTargets([a])}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </RowActions>
                </td>
              </tr>
            );
          })}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                {articles.length === 0 ? "No articles yet." : "No articles match these filters."}
              </td>
            </tr>
          )}
        </tbody>
      </TableBox>

      <TablePagination paging={paging} />

      <ConfirmDialog
        open={!!deleteTargets}
        onOpenChange={(o) => !o && setDeleteTargets(null)}
        title={deleteTargets?.length === 1 ? `Delete “${deleteTargets[0].title}”?` : `Delete ${deleteTargets?.length ?? 0} articles?`}
        description="Articles and their version history are removed for good, and the agent stops using them. To take an article out of answers for now, unpublish it instead."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          const list = deleteTargets ?? [];
          setDeleteTargets(null);
          if (list.length === 1) await run(list[0].id, () => deleteKbArticleAction(list[0].id), `Deleted “${list[0].title}”.`);
          else if (list.length) await bulk(list, (a) => deleteKbArticleAction(a.id), "Deleted");
        }}
      />
    </div>
  );
}
