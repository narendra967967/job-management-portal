"use client";

// Knowledge base articles: a filterable table (stacked rows below lg). Keywords
// match the title, summary, keywords and article text.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Card } from "@/components/admin/ui/card";
import { Button, buttonVariants } from "@/components/admin/ui/button";
import { Badge } from "@/components/admin/ui/badge";
import { Input } from "@/components/admin/ui/input";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { toast } from "@/components/admin/ui/toast";
import { deleteArticle, setArticleStatus, useKb } from "@/lib/kb-mock";
import { KB_CATEGORIES, kbHtmlToText, type KbArticle } from "@/lib/kb-model";
import { useMounted } from "@/lib/use-mounted";
import { cn, formatDateTime } from "@/lib/utils";

const selectCls =
  "h-11 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none sm:h-9 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function KbArticles() {
  const { articles } = useKb();
  const mounted = useMounted();
  const [query, setQuery] = useState("");
  const [fCategory, setFCategory] = useState("all");
  const [fStatus, setFStatus] = useState<"all" | KbArticle["status"]>("all");
  const [deleteTarget, setDeleteTarget] = useState<KbArticle | null>(null);

  const published = articles.filter((a) => a.status === "published").length;
  const filtering = query.trim() !== "" || fCategory !== "all" || fStatus !== "all";

  const filtered = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return articles
      .filter((a) => {
        const hay = `${a.title} ${a.summary} ${a.keywords.join(" ")} ${kbHtmlToText(a.contentHtml)}`.toLowerCase();
        return (
          (fCategory === "all" || a.category === fCategory) &&
          (fStatus === "all" || a.status === fStatus) &&
          words.every((w) => hay.includes(w))
        );
      })
      .sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
  }, [articles, query, fCategory, fStatus]);

  const togglePublish = (a: KbArticle) => {
    const next = a.status === "published" ? "draft" : "published";
    setArticleStatus(a.id, next);
    toast.success(next === "published" ? `“${a.title}” is published.` : `“${a.title}” is back to draft.`);
  };

  const actions = (a: KbArticle, labelled: boolean) => {
    const live = a.status === "published";
    return (
      <>
        <Button
          variant={labelled ? "outline" : "ghost"}
          size={labelled ? "default" : "icon"}
          aria-label={`${live ? "Unpublish" : "Publish"} ${a.title}`}
          title={live ? "Unpublish" : "Publish"}
          onClick={() => togglePublish(a)}
        >
          {live ? <EyeOff className={labelled ? "size-3.5" : "size-4"} aria-hidden /> : <Eye className={labelled ? "size-3.5" : "size-4"} aria-hidden />}
          {labelled && (live ? "Unpublish" : "Publish")}
        </Button>
        <Link
          href={`/jmp-admin/knowledge-base/articles/${a.id}`}
          aria-label={`Edit ${a.title}`}
          title="Edit"
          className={cn(buttonVariants(labelled ? { variant: "outline" } : { variant: "ghost", size: "icon" }))}
        >
          <Pencil className={labelled ? "size-3.5" : "size-4"} aria-hidden />
          {labelled && "Edit"}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${a.title}`}
          title="Delete"
          onClick={() => setDeleteTarget(a)}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </>
    );
  };

  const statusBadge = (a: KbArticle) => (
    <Badge variant={a.status === "published" ? "success" : "neutral"}>{a.status === "published" ? "Published" : "Draft"}</Badge>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {articles.length} {articles.length === 1 ? "article" : "articles"} · {published} published
        </p>
        <Link href="/jmp-admin/knowledge-base/articles/new" className={cn(buttonVariants(), "px-3")}>
          <Plus className="size-4" aria-hidden />
          Add article
        </Link>
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
        {filtering && (
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setQuery("");
                setFCategory("all");
                setFStatus("all");
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
                  <th scope="col" className="w-48 px-3 py-2.5 font-medium">Category</th>
                  <th scope="col" className="w-28 px-3 py-2.5 font-medium">Status</th>
                  <th scope="col" className="hidden w-44 px-3 py-2.5 font-medium xl:table-cell">Updated</th>
                  <th scope="col" className="w-32 px-3 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2.5">
                      <Link href={`/jmp-admin/knowledge-base/articles/${a.id}`} className="block truncate font-medium hover:text-primary">
                        {a.title}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{a.summary}</p>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.category}</td>
                    <td className="px-3 py-2.5">{statusBadge(a)}</td>
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
              <div key={a.id} className="space-y-2.5 p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link href={`/jmp-admin/knowledge-base/articles/${a.id}`} className="text-sm font-medium hover:text-primary">
                      {a.title}
                    </Link>
                    {statusBadge(a)}
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
        onConfirm={() => {
          const a = deleteTarget;
          setDeleteTarget(null);
          if (a) {
            deleteArticle(a.id);
            toast.success(`Deleted “${a.title}”.`);
          }
        }}
      />
    </div>
  );
}
