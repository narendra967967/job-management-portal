"use client";

// How-to guide editor (admin). One page per guide: details (title, URL id,
// summary, icon, Active / In progress) and the body in a WordPress-style editor
// (Visual / Code). Saves through Server Actions; the server validates and
// sanitizes the HTML before storing it.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Save } from "lucide-react";
import { Card } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Button, buttonVariants } from "@/components/admin/ui/button";
import { HtmlEditor } from "@/components/admin/guides/html-editor";
import { createGuideAction, updateGuideAction } from "@/actions/admin-guides";
import { GUIDE_ICON_KEYS, slugify, type GuideStatus, type GuideTopic } from "@/lib/guides-model";
import { GUIDE_ICONS } from "@/lib/guide-icons";
import { cn } from "@/lib/utils";

interface FormValues {
  slug: string;
  title: string;
  summary: string;
  icon: string;
  status: GuideStatus;
  inProgress: boolean;
  contentHtml: string;
}

export function GuideEditor({
  topic,
  justCreated = false,
}: {
  topic?: GuideTopic;
  /** Arrived here right after "Create guide" — confirm it. */
  justCreated?: boolean;
}) {
  const router = useRouter();
  const isNew = !topic;
  const initial: FormValues = useMemo(
    () => ({
      slug: topic?.slug ?? "",
      title: topic?.title ?? "",
      summary: topic?.summary ?? "",
      icon: topic?.icon ?? "book-open",
      status: topic?.status ?? "inactive",
      inProgress: topic?.inProgress ?? false,
      contentHtml: topic?.contentHtml ?? "",
    }),
    [topic],
  );
  const [v, setV] = useState<FormValues>(initial);
  // The URL id follows the title unless it was customised (an existing guide
  // whose id doesn't match its title counts as customised).
  const [slugTouched, setSlugTouched] = useState(
    !isNew && !!topic && topic.slug !== slugify(topic.title),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(justCreated);
  const [createdNotice, setCreatedNotice] = useState(justCreated);

  // After a save, the refreshed (server-sanitized) guide comes back as a new
  // prop — adopt it so the form isn't falsely "dirty".
  const savedAt = topic?.updatedAt;
  useEffect(() => {
    setV(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedAt]);

  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const set = (patch: Partial<FormValues>) => {
    setV((prev) => ({ ...prev, ...patch }));
    setSaved(false);
    setCreatedNotice(false);
  };

  async function save() {
    setError("");
    if (!v.title.trim()) return setError("Title is required.");
    if (!v.slug.trim()) return setError("URL id is required.");
    setSaving(true);
    const payload = { ...v, title: v.title.trim() };
    const res = isNew ? await createGuideAction(payload) : await updateGuideAction(topic!.id, payload);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setSaved(true);
    setCreatedNotice(false);
    if (isNew && "id" in res) router.replace(`/jmp-admin/guides/${res.id}?created=1`);
    else router.refresh();
  }

  const status =
    error ||
    (saved
      ? createdNotice
        ? v.status === "active"
          ? "Guide created — it's live."
          : "Guide created (inactive — switch on Active to publish)."
        : v.status === "active"
          ? "Saved — changes are live."
          : "Saved (inactive — not shown to users)."
      : dirty
        ? "Unsaved changes"
        : isNew
          ? "New guide"
          : "No changes");

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/jmp-admin/guides" className={cn(buttonVariants({ variant: "ghost" }), "px-2")}>
          <ArrowLeft className="size-4" aria-hidden />
          All guides
        </Link>
        {!isNew && topic?.status === "active" && (
          <a
            href={`/guides?topic=${topic.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "px-3")}
          >
            <ExternalLink className="size-4" aria-hidden />
            View on site
          </a>
        )}
      </div>

      {/* ---- Details ---- */}
      <Card className="space-y-4 p-4 md:p-5">
        <h2 className="text-sm font-semibold">Details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" hint="Shown in the menu and as the guide's heading.">
            <Input
              value={v.title}
              maxLength={80}
              onChange={(e) => {
                const title = e.target.value;
                set(slugTouched ? { title } : { title, slug: slugify(title) });
              }}
              placeholder="Set up your AI key"
            />
          </Field>
          {/* URL id: follows the title automatically; "Edit" makes it custom. */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span id="guide-slug-label" className="text-sm font-medium">
                URL id
              </span>
              {slugTouched ? (
                <button
                  type="button"
                  onClick={() => {
                    setSlugTouched(false);
                    set({ slug: slugify(v.title) });
                  }}
                  className="min-h-8 text-xs font-medium text-primary hover:underline"
                >
                  Match title
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSlugTouched(true)}
                  className="min-h-8 text-xs font-medium text-primary hover:underline"
                >
                  Edit
                </button>
              )}
            </div>
            <Input
              aria-labelledby="guide-slug-label"
              value={v.slug}
              maxLength={60}
              readOnly={!slugTouched}
              onChange={(e) => set({ slug: slugify(e.target.value) })}
              placeholder="generated-from-the-title"
              className={cn(!slugTouched && "bg-muted/50 text-muted-foreground")}
            />
            <span className="block text-[11px] text-muted-foreground">
              {slugTouched ? "Custom" : "Generated from the title"} · /guides?topic={v.slug || "…"}
              {!isNew && topic && v.slug !== topic.slug ? " — the old link will stop working." : ""}
            </span>
          </div>
          <Field label="Summary" hint="One line under the title." className="sm:col-span-2">
            <Input
              value={v.summary}
              maxLength={200}
              onChange={(e) => set({ summary: e.target.value })}
              placeholder="Connect OpenAI, Anthropic or OpenRouter so AI features work."
            />
          </Field>
          <Toggle
            checked={v.status === "active"}
            onChange={(on) => set({ status: on ? "active" : "inactive" })}
            label="Active"
            hint="Only active guides are shown to users."
          />
          <Toggle
            checked={v.inProgress}
            onChange={(on) => set({ inProgress: on })}
            label="In progress"
            hint="Shows a “Guide in progress” badge."
          />
        </div>
        <div>
          <p className="text-sm font-medium">Icon</p>
          <div role="radiogroup" aria-label="Icon" className="mt-2 flex flex-wrap gap-1.5">
            {GUIDE_ICON_KEYS.map((key) => {
              const Icon = GUIDE_ICONS[key];
              const on = v.icon === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={key}
                  title={key}
                  onClick={() => set({ icon: key })}
                  className={cn(
                    "flex size-11 items-center justify-center rounded-lg border transition-colors sm:size-9",
                    on ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* ---- Content ---- */}
      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold">Content</h2>
        <HtmlEditor value={v.contentHtml} onChange={(contentHtml) => set({ contentHtml })} />
        <p className="px-1 text-[11px] text-muted-foreground">
          Scripts, styles and unsafe attributes are removed on save. Videos can be embedded from YouTube,
          Vimeo or Loom, or as an https .mp4 file.
        </p>
      </section>

      {/* ---- Save bar ---- */}
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
          <Link href="/jmp-admin/guides" className={cn(buttonVariants({ variant: "outline" }), "px-3")}>
            Cancel
          </Link>
          <Button onClick={save} disabled={saving || (!dirty && !isNew)}>
            <Save className="size-4" aria-hidden />
            {saving ? "Saving…" : isNew ? "Create guide" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      {label && <span className="text-sm font-medium">{label}</span>}
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center gap-3 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "inline-block size-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5.5" : "translate-x-0.5",
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-[11px] text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
