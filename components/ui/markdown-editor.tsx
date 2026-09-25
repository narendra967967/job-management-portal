"use client";

// A lightweight Markdown editor for descriptive fields (job description, notes).
// Not a WYSIWYG: a formatting toolbar inserts plain-Markdown syntax into a
// textarea, and an Eye toggle previews it with MarkdownLite (the same renderer
// the detail page uses). The stored value stays plain text — no new dependency,
// no schema change, no HTML/XSS surface.

import { useRef, useState, type KeyboardEvent } from "react";
import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Link2,
  Code,
  Eye,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownLite } from "@/components/ui/markdown-lite";

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Extra classes for the textarea (e.g. min-height). */
  className?: string;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  function restoreSelection(start: number, end: number) {
    requestAnimationFrame(() => {
      const el = ref.current;
      if (el) {
        el.focus();
        el.setSelectionRange(start, end);
      }
    });
  }

  /** Wrap the current selection with `before`/`after` markers. */
  function surround(before: string, after = before) {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const sel = value.slice(s, e);
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    onChange(next);
    restoreSelection(s + before.length, s + before.length + sel.length);
  }

  /** Prefix each line in the selection (for lists / headings). */
  function prefixLines(makePrefix: (i: number) => string) {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const lineStart = value.lastIndexOf("\n", s - 1) + 1;
    const after = value.indexOf("\n", e);
    const lineEnd = after === -1 ? value.length : after;
    const block = value.slice(lineStart, lineEnd);
    const newBlock = block
      .split("\n")
      .map((ln, i) => makePrefix(i) + ln)
      .join("\n");
    const next = value.slice(0, lineStart) + newBlock + value.slice(lineEnd);
    onChange(next);
    restoreSelection(lineStart, lineStart + newBlock.length);
  }

  function insertLink() {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const label = value.slice(s, e) || "text";
    const snippet = `[${label}](https://)`;
    const next = value.slice(0, s) + snippet + value.slice(e);
    onChange(next);
    // Select the "https://" so the user can type the URL immediately.
    const urlStart = s + label.length + 3;
    restoreSelection(urlStart, urlStart + 8);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === "b") {
      e.preventDefault();
      surround("**");
    } else if (k === "i") {
      e.preventDefault();
      surround("*");
    }
  }

  const tools: {
    icon: typeof Bold;
    label: string;
    run: () => void;
  }[] = [
    { icon: Bold, label: "Bold (Ctrl/Cmd+B)", run: () => surround("**") },
    { icon: Italic, label: "Italic (Ctrl/Cmd+I)", run: () => surround("*") },
    { icon: Heading2, label: "Heading", run: () => prefixLines(() => "## ") },
    { icon: List, label: "Bulleted list", run: () => prefixLines(() => "- ") },
    {
      icon: ListOrdered,
      label: "Numbered list",
      run: () => prefixLines((i) => `${i + 1}. `),
    },
    { icon: Code, label: "Inline code", run: () => surround("`") },
    { icon: Link2, label: "Link", run: insertLink },
  ];

  return (
    <div className="rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-input px-1.5 py-1">
        {tools.map(({ icon: Icon, label, run }) => (
          <button
            key={label}
            type="button"
            title={label}
            aria-label={label}
            // Keep the textarea's selection when clicking a tool.
            onMouseDown={(e) => e.preventDefault()}
            onClick={run}
            disabled={preview}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <Icon className="size-4" aria-hidden />
          </button>
        ))}
        <button
          type="button"
          title={preview ? "Edit" : "Preview"}
          aria-label={preview ? "Edit" : "Preview"}
          aria-pressed={preview}
          onClick={() => setPreview((p) => !p)}
          className="ml-auto flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {preview ? (
            <>
              <Pencil className="size-3.5" aria-hidden />
              Edit
            </>
          ) : (
            <>
              <Eye className="size-3.5" aria-hidden />
              Preview
            </>
          )}
        </button>
      </div>

      {preview ? (
        <div className={cn("overflow-y-auto px-3 py-2", className)}>
          {value.trim() ? (
            <MarkdownLite text={value} />
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
          )}
        </div>
      ) : (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className={cn(
            "w-full resize-y rounded-b-lg bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground",
            className,
          )}
        />
      )}
    </div>
  );
}
