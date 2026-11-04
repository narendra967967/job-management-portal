"use client";

// Knowledge base articles: a filterable table (stacked rows below lg). Keywords
// match the title, summary, keywords and article text. Repo articles come from
// docs/knowledge-base and are view-only here; "Sync from repo" reloads them.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, FolderGit2, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { Card } from "@/components/admin/ui/card";
import { Button, buttonVariants } from "@/components/admin/ui/button";
import { Badge } from "@/components/admin/ui/badge";
import { Input } from "@/components/admin/ui/input";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { toast } from "@/components/admin/ui/toast";
import { deleteKbArticleAction, setKbArticleStatusAction, syncKbAction } from "@/actions/admin-kb";
import { KB_CATEGORIES, kbHtmlToText, type KbArticle } from "@/lib/kb-model";
import { useMounted } from "@/lib/use-mounted";
import { cn, formatDateTime } from "@/lib/utils";

const selectCls =
  "h-11 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none sm:h-9 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function KbArticles({ articles }: { articles: KbArticle[] }) {
  const router = useRouter();
  const mounted = useMounted();
  const [query, setQuery] = useState("");
  const [fCategory, setFCategory] = useState("all");
  const [fStatus, setFStatus] = useState<"all" | KbArticle["status"]>("all");
  const [fSource, setFSource] = useState<"all" | KbArticle["source"]>("all");
  const [deleteTarget, setDeleteTarget] = useState<KbArticle | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const published = articles.filter((a) => a.status === "published").length;
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

  async function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    setBusy(id);
    const res = await fn();
    setBusy(null);
    if (res.ok) {
      toast.success(okMsg);
      router.refresh();
    } else toast.error(res.error ?? "Something went wrong.");
  }

  async function sync() {
    setBusy("sync");
    const res = await syncKbAction();
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    const { added, updated, removed, unchanged, errors } = res.result;
    const changed = added + updated + removed;
    const parts = [
      added && `${added} added`,
      updated && `${updated} updated`,
      removed && `${removed} removed`,
    ].filter(Boolean);
    if (errors.length) {
      toast.error(`${errors.length} ${errors.length === 1 ? "file has" : "files have"} a problem: ${errors.map((e) => `${e.file} (${e.error})`).join("; ")}`);
    }
    if (changed) toast.success(`Synced: ${parts.join(", ")}.`);
    else if (!errors.length) toast.success(`Already up to date (${unchanged} ${unchanged === 1 ? "file" : "files"}).`);
    router.refresh();
  }

  const actions = (a: KbArticle, labelled: boolean) => {
    const iconCls = labelled ? "size-3.5" : "size-4";
    if (a.source === "repo") {
      return (
        <Link
          href={`/jmp-admin/knowledge-base/articles/${a.id}`}
          aria-label={`View ${a.title}`}
          title="View"
          className={cn(buttonVariants(labelled ? { variant: "outline" } : { variant: "ghost", size: "icon" }))}
        >
          <Eye className={iconCls} aria-hidden />
          {labelled && "View"}
        </Link>
      );
    }
    const live = a.status === "published";
    return (
      <>
        <Button
          variant={labelled ? "outline" : "ghost"}
          size={labelled ? "default" : "icon"}
          aria-label={`${live ? "Unpublish" : "Publish"} ${a.title}`}
          title={live ? "Unpublish" : "Publish"}
          disabled={busy === a.id}
          onClick={() =>
            run(
              a.id,
              () => setKbArticleStatusAction(a.id, live ? "draft" : "published"),
              live ? `“${a.title}” is back to draft.` : `“${a.title}” is published.`,
            )
          }
        >
          {live ? <EyeOff className={iconCls} aria-hidden /> : <Eye className={iconCls} aria-hidden />}
          {labelled && (live ? "Unpublish" : "Publish")}
        </Button>
        <Link
          href={`/jmp-admin/knowledge-base/articles/${a.id}`}
          aria-label={`Edit ${a.title}`}
          title="Edit"
          className={cn(buttonVariants(labelled ? { variant: "outline" } : { variant: "ghost", size: "icon" }))}
        >
          <Pencil className={iconCls} aria-hidden />
          {labelled && "Edit"}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${a.title}`}
          title="Delete"
          disabled={busy === a.id}
          onClick={() => setDeleteTarget(a)}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </>
    );
  };

  const badges = (a: KbArticle) => (
    <>
      <Badge variant={a.status === "published" ? "success" : "neutral"}>{a.status === "published" ? "Published" : "Draft"}</Badge>
      {a.source === "repo" && (
        <Badge variant="neutral" className="gap-1">
          <FolderGit2 className="size-3" aria-hidden />
          Repo
        </Badge>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {articles.length} {articles.length === 1 ? "article" : "articles"} · {published} published
        </p>
        <div className="flex flex-wrap gap-2">
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
        <select className={selectCls} value={fCategory} onChange={(e) => setFCategory(e.target.value)} aria-label="Filter category">
          <option value="all">All categories</option>
          {KB_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select className={selectCls} value={fStatus} onChange={(e) => setFStatus(e.target.value as typeof fStatus)} aria-label="Filter status">
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <select className={selectCls} value={fSource} onChange={(e) => setFSource(e.target.value as typeof fSource)} aria-label="Filter source">
          <option value="all">All sources</option>
          <option value="repo">Repo</option>
          <option value="admin">Written here</option>
        </select>
        {filtering && (
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setQuery("");
                setFCategory("all");
                setFStatus("all");
                setFSource("all");
              }}
            >
              Clear
            </Button>
            <span className="ml-auto text-sm text-muted-foreground">
              {filtered.length} of {articles.length}
            </span>
          </>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {articles.length === 0 ? "No articles yet." : "No articles match these filters."}
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-hidden p-0 lg:block">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-3 py-2.5 font-medium">Article</th>
                  <th scope="col" className="w-44 px-3 py-2.5 font-medium">Category</th>
                  <th scope="col" className="w-40 px-3 py-2.5 font-medium">Status</th>
                  <th scope="col" className="hidden w-44 px-3 py-2.5 font-medium xl:table-cell">Updated</th>
                  <th scope="col" className="w-32 px-3 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((a) => (
                  <tr key={a.id} className={cn(busy === a.id && "opacity-60")}>
                    <td className="px-3 py-2.5">
                      <Link href={`/jmp-admin/knowledge-base/articles/${a.id}`} className="block truncate font-medium hover:text-primary">
                        {a.title}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{a.summary}</p>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.category}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">{badges(a)}</div>
                    </td>
                    <td className="hidden px-3 py-2.5 text-xs text-muted-foreground xl:table-cell">
                      {mounted ? formatDateTime(a.updatedAt) : ""}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end">{actions(a, false)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="divide-y p-0 lg:hidden">
            {filtered.map((a) => (
              <div key={a.id} className={cn("space-y-2.5 p-3", busy === a.id && "opacity-60")}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link href={`/jmp-admin/knowledge-base/articles/${a.id}`} className="text-sm font-medium hover:text-primary">
                      {a.title}
                    </Link>
                    {badges(a)}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{a.summary}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {a.category}
                    {mounted ? ` · updated ${formatDateTime(a.updatedAt)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">{actions(a, true)}</div>
              </div>
            ))}
          </Card>
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete “${deleteTarget?.title ?? ""}”?`}
        description="The article and its version history are removed for good, and the agent stops using it. To take it out of answers for now, unpublish it instead."
        confirmLabel="Delete article"
        destructive
        onConfirm={async () => {
          const a = deleteTarget;
          setDeleteTarget(null);
          if (a) await run(a.id, () => deleteKbArticleAction(a.id), `Deleted “${a.title}”.`);
        }}
      />
    </div>
  );
}
