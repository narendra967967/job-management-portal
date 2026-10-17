"use client";

// How-to guide editor (admin). One page for a whole topic: details (title, URL
// id, summary, menu group, icon, status) and the content — sections, each a
// list of blocks (text, steps, tip box, video, screenshot, buttons). Blocks and
// sections reorder with up/down buttons (works on touch, no drag needed).
// Saves through Server Actions; the server re-validates everything.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ExternalLink,
  Image as ImageIcon,
  Lightbulb,
  ListOrdered,
  Plus,
  Save,
  Trash2,
  Type,
  Video,
  Link2,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Button, buttonVariants } from "@/components/admin/ui/button";
import { createGuideAction, updateGuideAction } from "@/actions/admin-guides";
import {
  GUIDE_BLOCK_LABELS,
  GUIDE_ICON_KEYS,
  emptyBlock,
  slugify,
  type GuideBlock,
  type GuideBlockType,
  type GuideSection,
  type GuideStatus,
  type GuideTopic,
} from "@/lib/guides-model";
import { GUIDE_ICONS } from "@/lib/guide-icons";
import { cn } from "@/lib/utils";

interface FormValues {
  slug: string;
  title: string;
  summary: string;
  icon: string;
  group: string;
  status: GuideStatus;
  inProgress: boolean;
  sections: GuideSection[];
}

const BLOCK_ICONS: Record<GuideBlockType, LucideIcon> = {
  text: Type,
  steps: ListOrdered,
  callout: Lightbulb,
  video: Video,
  image: ImageIcon,
  links: Link2,
};
const BLOCK_TYPES = Object.keys(GUIDE_BLOCK_LABELS) as GuideBlockType[];

const textareaCls =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

/** Move item i by d (−1 up / +1 down); returns a new array. */
function move<T>(arr: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const next = arr.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function GuideEditor({
  topic,
  groups,
  justCreated = false,
}: {
  topic?: GuideTopic;
  groups: string[];
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
      group: topic?.group ?? groups[0] ?? "",
      status: topic?.status ?? "inactive",
      inProgress: topic?.inProgress ?? false,
      sections: topic?.sections ?? [{ heading: "", blocks: [emptyBlock("text")] }],
    }),
    [topic, groups],
  );
  const [v, setV] = useState<FormValues>(initial);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(justCreated);
  const [createdNotice, setCreatedNotice] = useState(justCreated);

  // After a save, the refreshed (server-normalised, e.g. trimmed) topic comes
  // back as a new prop — adopt it so the form isn't falsely "dirty".
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
  const setSections = (fn: (s: GuideSection[]) => GuideSection[]) => set({ sections: fn(v.sections) });
  const setSection = (i: number, patch: Partial<GuideSection>) =>
    setSections((s) => s.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const setBlock = (si: number, bi: number, block: GuideBlock) =>
    setSection(si, { blocks: v.sections[si].blocks.map((b, k) => (k === bi ? block : b)) });

  async function save() {
    setError("");
    if (!v.title.trim()) return setError("Title is required.");
    if (!v.slug.trim()) return setError("URL id is required.");
    if (!v.group.trim()) return setError("Menu group is required.");
    setSaving(true);
    const payload = { ...v, title: v.title.trim(), group: v.group.trim() };
    const res = isNew ? await createGuideAction(payload) : await updateGuideAction(topic!.id, payload);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setSaved(true);
    setCreatedNotice(false);
    if (isNew && "id" in res) router.replace(`/jmp-admin/guides/${res.id}?created=1`);
    else router.refresh();
  }

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
          <Field
            label="URL id"
            hint={`Link: /guides?topic=${v.slug || "…"} — changing it breaks old links.`}
          >
            <Input
              value={v.slug}
              maxLength={60}
              onChange={(e) => {
                setSlugTouched(true);
                set({ slug: slugify(e.target.value) });
              }}
              placeholder="set-up-your-ai-key"
            />
          </Field>
          <Field label="Summary" hint="One line under the title." className="sm:col-span-2">
            <Input
              value={v.summary}
              maxLength={200}
              onChange={(e) => set({ summary: e.target.value })}
              placeholder="Connect OpenAI, Anthropic or OpenRouter so AI features work."
            />
          </Field>
          <Field label="Menu group" hint="Heading it sits under. Pick one or type a new one.">
            <Input
              value={v.group}
              maxLength={40}
              list="guide-groups"
              onChange={(e) => set({ group: e.target.value })}
              placeholder="Start here"
            />
            <datalist id="guide-groups">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </Field>
          <div className="space-y-2">
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
      {v.sections.map((section, si) => (
        <Card key={si} className="space-y-3 p-4 md:p-5">
          <div className="flex items-end gap-2">
            <Field label={`Section ${si + 1}`} className="flex-1">
              <Input
                value={section.heading}
                maxLength={120}
                onChange={(e) => setSection(si, { heading: e.target.value })}
                placeholder="Section heading, e.g. Add your key"
              />
            </Field>
            <MoveDelete
              label={`section ${si + 1}`}
              canUp={si > 0}
              canDown={si < v.sections.length - 1}
              onUp={() => setSections((s) => move(s, si, -1))}
              onDown={() => setSections((s) => move(s, si, 1))}
              onDelete={() => setSections((s) => s.filter((_, k) => k !== si))}
            />
          </div>

          {section.blocks.map((block, bi) => {
            const Icon = BLOCK_ICONS[block.type];
            return (
              <div key={bi} className="rounded-xl border bg-muted/30 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Icon className="size-3.5" aria-hidden />
                    {GUIDE_BLOCK_LABELS[block.type]}
                  </span>
                  <MoveDelete
                    label={`${GUIDE_BLOCK_LABELS[block.type]} block`}
                    canUp={bi > 0}
                    canDown={bi < section.blocks.length - 1}
                    onUp={() => setSection(si, { blocks: move(section.blocks, bi, -1) })}
                    onDown={() => setSection(si, { blocks: move(section.blocks, bi, 1) })}
                    onDelete={() => setSection(si, { blocks: section.blocks.filter((_, k) => k !== bi) })}
                  />
                </div>
                <BlockFields block={block} onChange={(b) => setBlock(si, bi, b)} />
              </div>
            );
          })}

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Add to this section</p>
            <div className="flex flex-wrap gap-1.5">
              {BLOCK_TYPES.map((t) => {
                const Icon = BLOCK_ICONS[t];
                return (
                  <Button
                    key={t}
                    type="button"
                    variant="outline"
                    onClick={() => setSection(si, { blocks: [...section.blocks, emptyBlock(t)] })}
                  >
                    <Icon className="size-3.5" aria-hidden />
                    {GUIDE_BLOCK_LABELS[t]}
                  </Button>
                );
              })}
            </div>
          </div>
        </Card>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() => setSections((s) => [...s, { heading: "", blocks: [emptyBlock("text")] }])}
      >
        <Plus className="size-4" aria-hidden />
        Add section
      </Button>

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
            {error ||
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
                    : "No changes")}
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

/* ---------------- block fields ---------------- */

function BlockFields({ block, onChange }: { block: GuideBlock; onChange: (b: GuideBlock) => void }) {
  switch (block.type) {
    case "text":
      return (
        <Field hint="Supports **bold**, *italic*, `code`, [link](https://…), “- ” bullets and “1. ” lists.">
          <textarea
            className={textareaCls}
            rows={5}
            maxLength={8000}
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            placeholder="Write the explanation…"
          />
        </Field>
      );

    case "steps":
      return (
        <div className="space-y-2">
          {block.steps.map((s, i) => (
            <div key={i} className="flex gap-2">
              <span className="mt-2 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <Input
                  value={s.title}
                  maxLength={200}
                  onChange={(e) =>
                    onChange({ ...block, steps: block.steps.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)) })
                  }
                  placeholder="Step title"
                />
                <textarea
                  className={textareaCls}
                  rows={2}
                  maxLength={1000}
                  value={s.detail ?? ""}
                  onChange={(e) =>
                    onChange({ ...block, steps: block.steps.map((x, k) => (k === i ? { ...x, detail: e.target.value } : x)) })
                  }
                  placeholder="More detail (optional)"
                />
              </div>
              <MoveDelete
                label={`step ${i + 1}`}
                canUp={i > 0}
                canDown={i < block.steps.length - 1}
                onUp={() => onChange({ ...block, steps: move(block.steps, i, -1) })}
                onDown={() => onChange({ ...block, steps: move(block.steps, i, 1) })}
                onDelete={() => onChange({ ...block, steps: block.steps.filter((_, k) => k !== i) })}
                vertical
              />
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            disabled={block.steps.length >= 30}
            onClick={() => onChange({ ...block, steps: [...block.steps, { title: "", detail: "" }] })}
          >
            <Plus className="size-3.5" aria-hidden />
            Add step
          </Button>
        </div>
      );

    case "callout":
      return (
        <div className="space-y-2">
          <div role="radiogroup" aria-label="Box style" className="flex flex-wrap gap-1.5">
            {(
              [
                ["tip", "Tip", "bg-status-applied text-status-applied-foreground"],
                ["note", "Note", "bg-status-new text-status-new-foreground"],
                ["warning", "Important", "bg-status-shortlisted text-status-shortlisted-foreground"],
              ] as const
            ).map(([tone, label, cls]) => (
              <button
                key={tone}
                type="button"
                role="radio"
                aria-checked={block.tone === tone}
                onClick={() => onChange({ ...block, tone })}
                className={cn(
                  "min-h-11 rounded-full px-3 text-xs font-medium ring-offset-2 sm:min-h-8",
                  cls,
                  block.tone === tone ? "ring-2 ring-ring" : "opacity-70 hover:opacity-100",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Input
            value={block.title ?? ""}
            maxLength={120}
            onChange={(e) => onChange({ ...block, title: e.target.value })}
            placeholder="Box title (optional — defaults to Tip / Note / Important)"
          />
          <textarea
            className={textareaCls}
            rows={3}
            maxLength={2000}
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            placeholder="Box text"
          />
        </div>
      );

    case "video":
      return (
        <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
          <Input
            value={block.title}
            maxLength={160}
            onChange={(e) => onChange({ ...block, title: e.target.value })}
            placeholder="Video title"
          />
          <Input
            value={block.duration ?? ""}
            maxLength={20}
            onChange={(e) => onChange({ ...block, duration: e.target.value })}
            placeholder="Length, e.g. 2:30"
          />
          <Field
            className="sm:col-span-2"
            hint="YouTube, Vimeo or Loom links play inside the page. Leave empty to show “video coming soon”."
          >
            <Input
              value={block.url}
              maxLength={500}
              inputMode="url"
              onChange={(e) => onChange({ ...block, url: e.target.value.trim() })}
              placeholder="https://www.youtube.com/watch?v=…"
            />
          </Field>
        </div>
      );

    case "image":
      return (
        <div className="space-y-2">
          <Field hint="https://… or a file in /public, e.g. /guides/ai-key-1.png">
            <Input
              value={block.src}
              maxLength={500}
              inputMode="url"
              onChange={(e) => onChange({ ...block, src: e.target.value.trim() })}
              placeholder="https://… or /guides/screenshot.png"
            />
          </Field>
          <Input
            value={block.alt}
            maxLength={200}
            onChange={(e) => onChange({ ...block, alt: e.target.value })}
            placeholder="What the screenshot shows (for screen readers)"
          />
          <Input
            value={block.caption ?? ""}
            maxLength={300}
            onChange={(e) => onChange({ ...block, caption: e.target.value })}
            placeholder="Caption (optional)"
          />
          {/^(https:\/\/|\/(?!\/))/.test(block.src) && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={block.src} alt={block.alt} className="max-h-40 rounded-lg border" />
          )}
        </div>
      );

    case "links":
      return (
        <div className="space-y-2">
          {block.links.map((l, i) => (
            <div key={i} className="flex gap-2">
              <div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-2">
                <Input
                  value={l.label}
                  maxLength={80}
                  onChange={(e) =>
                    onChange({ ...block, links: block.links.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })
                  }
                  placeholder="Button label, e.g. Open Settings → AI provider"
                />
                <Input
                  value={l.href}
                  maxLength={500}
                  onChange={(e) =>
                    onChange({ ...block, links: block.links.map((x, k) => (k === i ? { ...x, href: e.target.value.trim() } : x)) })
                  }
                  placeholder="/settings?tab=ai or https://…"
                />
              </div>
              <MoveDelete
                label={`button ${i + 1}`}
                canUp={i > 0}
                canDown={i < block.links.length - 1}
                onUp={() => onChange({ ...block, links: move(block.links, i, -1) })}
                onDown={() => onChange({ ...block, links: move(block.links, i, 1) })}
                onDelete={() => onChange({ ...block, links: block.links.filter((_, k) => k !== i) })}
                vertical
              />
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">
            App pages start with “/” (e.g. /settings?tab=ai, /leads). Outside links need https://.
          </p>
          <Button
            type="button"
            variant="ghost"
            disabled={block.links.length >= 6}
            onClick={() => onChange({ ...block, links: [...block.links, { label: "", href: "" }] })}
          >
            <Plus className="size-3.5" aria-hidden />
            Add button
          </Button>
        </div>
      );
  }
}

/* ---------------- small pieces ---------------- */

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

function MoveDelete({
  label,
  canUp,
  canDown,
  onUp,
  onDown,
  onDelete,
  vertical,
}: {
  label: string;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
  vertical?: boolean;
}) {
  return (
    <div className={cn("flex shrink-0 gap-0.5", vertical && "flex-col")}>
      <Button type="button" variant="ghost" size="icon" aria-label={`Move ${label} up`} disabled={!canUp} onClick={onUp}>
        <ArrowUp className="size-4" aria-hidden />
      </Button>
      <Button type="button" variant="ghost" size="icon" aria-label={`Move ${label} down`} disabled={!canDown} onClick={onDown}>
        <ArrowDown className="size-4" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Delete ${label}`}
        onClick={onDelete}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
