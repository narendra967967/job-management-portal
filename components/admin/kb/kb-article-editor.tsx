"use client";

// Knowledge base article page. Articles written here: details, the body in the
// guide editor (Visual / Code) and version history. Repo articles
// (docs/knowledge-base): read-only, since the next sync would overwrite an edit.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FolderGit2, History, RotateCcw, Save } from "lucide-react";
import { Card } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Badge } from "@/components/admin/ui/badge";
import { Button, buttonVariants } from "@/components/admin/ui/button";
import { toast } from "@/components/admin/ui/toast";
import { HtmlEditor } from "@/components/admin/guides/html-editor";
import { Field, Toggle } from "@/components/admin/guides/guide-editor";
import { saveKbArticleAction } from "@/actions/admin-kb";
import {
  KB_CATEGORIES,
  KB_REPO_DIR,
  parseKeywords,
  type KbArticle,
  type KbArticleVersion,
  type KbCategory,
} from "@/lib/kb-model";
import { useMounted } from "@/lib/use-mounted";
import { cn, formatDateTime } from "@/lib/utils";

const selectCls =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none sm:h-9 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const backLink = (
  <Link href="/jmp-admin/knowledge-base/articles" className={cn(buttonVariants({ variant: "ghost" }), "px-2")}>
    <ArrowLeft className="size-4" aria-hidden />
    All articles
  </Link>
);

interface FormValues {
  title: string;
  category: KbCategory;
  summary: string;
  keywords: string;
  published: boolean;
  contentHtml: string;
}

export function KbArticleEditor({
  article,
  versions = [],
  initialTitle = "",
}: {
  article?: KbArticle;
  versions?: KbArticleVersion[];
  /** From an unanswered question. */
  initialTitle?: string;
}) {
  if (article?.source === "repo") return <KbRepoArticle article={article} />;
  return <AdminArticleForm article={article} versions={versions} initialTitle={initialTitle} />;
}

function AdminArticleForm({
  article,
  versions,
  initialTitle,
}: {
  article?: KbArticle;
  versions: KbArticleVersion[];
  initialTitle: string;
}) {
  const router = useRouter();
  const mounted = useMounted();
  const isNew = !article;

  const initial: FormValues = useMemo(
    () => ({
      title: article?.title ?? initialTitle,
      category: ((KB_CATEGORIES as readonly string[]).includes(article?.category ?? "")
        ? article!.category
        : KB_CATEGORIES[0]) as KbCategory,
      summary: article?.summary ?? "",
      keywords: article?.keywords.join(", ") ?? "",
      published: article?.status === "published",
      contentHtml: article?.contentHtml ?? "",
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [article?.id, article?.updatedAt],
  );
  const [v, setV] = useState<FormValues>(initial);
  useEffect(() => setV(initial), [initial]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const set = (patch: Partial<FormValues>) => {
    setV((prev) => ({ ...prev, ...patch }));
    setSaved(false);
    setError("");
  };

  async function save() {
    setError("");
    if (!v.title.trim()) return setError("Add a title.");
    if (!v.summary.trim()) return setError("Add a one-line summary. The agent uses it in answers.");
    setSaving(true);
    const res = await saveKbArticleAction(article?.id ?? null, {
      title: v.title.trim(),
      category: v.category,
      summary: v.summary.trim(),
      keywords: parseKeywords(v.keywords),
      status: v.published ? "published" : "draft",
      contentHtml: v.contentHtml,
    });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setSaved(true);
    if (isNew) {
      // The page re-mounts on its new address, so confirm with a toast.
      toast.success(v.published ? "Article created. The agent can use it now." : "Article created as a draft.");
      router.replace(`/jmp-admin/knowledge-base/articles/${res.id}`);
    } else {
      router.refresh();
    }
  }

  const status = error
    ? error
    : saved
      ? v.published
        ? "Saved. The agent can use it now."
        : "Saved as a draft. The agent won't use it yet."
      : dirty
        ? "Unsaved changes"
        : isNew
          ? "New article"
          : "No changes";

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-24">
      {backLink}

      <Card className="space-y-4 p-4 md:p-5">
        <h2 className="text-sm font-semibold">Details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" hint="Write it the way someone would ask." className="sm:col-span-2">
            <Input
              value={v.title}
              maxLength={120}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Nobody can sign in because of reCAPTCHA"
            />
          </Field>
          <Field label="Summary" hint="One or two sentences. The agent leads with this." className="sm:col-span-2">
            <Input
              value={v.summary}
              maxLength={240}
              onChange={(e) => set({ summary: e.target.value })}
              placeholder="If an admin is still signed in, untick reCAPTCHA in Settings → Security."
            />
          </Field>
          <Field label="Category">
            <select className={selectCls} value={v.category} onChange={(e) => set({ category: e.target.value as KbCategory })}>
              {KB_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Keywords" hint="Comma separated. Other words people might use, like “login” for sign-in.">
            <Input
              value={v.keywords}
              maxLength={300}
              onChange={(e) => set({ keywords: e.target.value })}
              placeholder="captcha, login, locked out"
            />
          </Field>
          <Toggle
            checked={v.published}
            onChange={(on) => set({ published: on })}
            label="Published"
            hint="Only published articles are used in answers."
          />
        </div>
      </Card>

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold">Content</h2>
        <HtmlEditor
          value={v.contentHtml}
          onChange={(contentHtml) => set({ contentHtml })}
          placeholder="Explain it the way you'd tell a colleague…"
        />
        <p className="px-1 text-[11px] text-muted-foreground">
          Never paste passwords, keys or other secrets here. Anything in an article can end up in an answer.
        </p>
      </section>

      {!isNew && (
        <Card className="space-y-3 p-4 md:p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <History className="size-4" aria-hidden />
            Version history
          </h2>
          {versions.length === 0 ? (
            <p className="text-xs text-muted-foreground">Earlier versions appear here after you save changes.</p>
          ) : (
            <ul className="divide-y">
              {versions.map((ver) => (
                <li key={ver.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0 text-xs">
                    <p className="truncate font-medium">{ver.title}</p>
                    <p className="text-muted-foreground">
                      {mounted ? formatDateTime(ver.savedAt) : ""}
                      {ver.savedBy ? ` · ${ver.savedBy}` : ""}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => set({ title: ver.title, contentHtml: ver.contentHtml })}>
                    <RotateCcw className="size-3.5" aria-hidden />
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-muted-foreground">Restoring fills the editor. Nothing changes until you save.</p>
        </Card>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur md:left-60">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-end gap-2 px-4 py-3">
          <p
            role="status"
            className={cn(
              "mr-auto text-xs",
              error ? "text-destructive" : saved ? "text-status-applied-foreground" : "text-muted-foreground",
            )}
          >
            {status}
          </p>
          <Link href="/jmp-admin/knowledge-base/articles" className={cn(buttonVariants({ variant: "outline" }), "px-3")}>
            Cancel
          </Link>
          <Button onClick={save} disabled={saving || (!dirty && !isNew)}>
            <Save className="size-4" aria-hidden />
            {saving ? "Saving…" : isNew ? "Create article" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** A repo article: shown as it reads, with where to change it. */
function KbRepoArticle({ article }: { article: KbArticle }) {
  const mounted = useMounted();
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {backLink}
      <Card className="space-y-3 p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={article.status === "published" ? "success" : "neutral"}>
            {article.status === "published" ? "Published" : "Draft"}
          </Badge>
          <Badge variant="neutral" className="gap-1">
            <FolderGit2 className="size-3" aria-hidden />
            Repo
          </Badge>
          <span className="text-xs text-muted-foreground">{article.category}</span>
        </div>
        <h2 className="text-lg font-semibold">{article.title}</h2>
        <p className="text-sm text-muted-foreground">{article.summary}</p>
        {article.keywords.length > 0 && (
          <p className="text-xs text-muted-foreground">Keywords: {article.keywords.join(", ")}</p>
        )}
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Read-only. This comes from <code className="break-all">{`${KB_REPO_DIR}/${article.slug}.md`}</code> and
          changes there, in the same commit as the code it describes.
          {mounted ? ` Last synced ${formatDateTime(article.updatedAt)}.` : ""}
        </p>
      </Card>
      <Card className="p-4 md:p-5">
        {/* Sanitized on sync (lib/kb-files.ts). */}
        <div className="guide-content text-sm" dangerouslySetInnerHTML={{ __html: article.contentHtml }} />
      </Card>
    </div>
  );
}
