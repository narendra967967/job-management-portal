"use client";

// WordPress-style content editor for How-to guides (admin only): a Visual tab
// (rich text with a toolbar) and a Code tab (raw HTML — paste <iframe>,
// <video>, tables, anything). Both edit the same HTML string. The server
// sanitizes it on save (lib/guide-html.ts), so the Visual view may show tags
// that are later removed — e.g. an iframe from a non-video site.
//
// Built on contentEditable + document.execCommand (no editor dependency):
// execCommand is deprecated but universally supported, and it keeps whatever
// HTML you paste, which is the point here.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  Code,
  Eraser,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  Unlink,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/admin/ui/input";
import { Button } from "@/components/admin/ui/button";
import { isAppPath, isHttpUrl, videoEmbedUrl } from "@/lib/guides-model";
import { cn } from "@/lib/utils";

type Mode = "visual" | "code";
type Insert = null | "link" | "image" | "video";

const BLOCKS: { value: string; label: string }[] = [
  { value: "p", label: "Paragraph" },
  { value: "h1", label: "Heading 1" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
  { value: "h4", label: "Heading 4" },
  { value: "blockquote", label: "Quote / note" },
  { value: "pre", label: "Code block" },
];

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Light pretty-print for the Code tab: one block element per line. */
function formatHtml(html: string): string {
  const blocks = "p|h[1-6]|ul|ol|li|blockquote|pre|table|thead|tbody|tfoot|tr|figure|figcaption|div|details|summary|iframe|video|hr";
  return html
    .replace(new RegExp(`\\s*(<(?:${blocks})\\b[^>]*>)`, "gi"), "\n$1")
    .replace(new RegExp(`(</(?:${blocks})>)\\s*`, "gi"), "$1\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function HtmlEditor({
  value,
  onChange,
  placeholder = "Start writing your guide…",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const [mode, setMode] = useState<Mode>("visual");
  const [code, setCode] = useState("");
  const [insert, setInsert] = useState<Insert>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [block, setBlock] = useState("p");
  const ref = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);

  // Keep the Visual DOM in sync with outside changes (initial load, after save)
  // without clobbering the caret while typing.
  useEffect(() => {
    const el = ref.current;
    if (mode === "visual" && el && el.innerHTML !== value && document.activeElement !== el) {
      el.innerHTML = value;
    }
  }, [value, mode]);

  const emit = useCallback(() => onChange(ref.current?.innerHTML ?? ""), [onChange]);

  // Paragraphs, not <div>s, for new lines (document-wide setting; also re-set on focus).
  useEffect(() => {
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      /* unsupported — Chrome/Edge/Safari/Firefox all support it */
    }
  }, []);

  // Reflect the current formatting in the toolbar.
  useEffect(() => {
    function update() {
      const el = ref.current;
      const sel = document.getSelection();
      if (!el || !sel || !sel.anchorNode || !el.contains(sel.anchorNode)) return;
      setActive({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        strikeThrough: document.queryCommandState("strikeThrough"),
        insertUnorderedList: document.queryCommandState("insertUnorderedList"),
        insertOrderedList: document.queryCommandState("insertOrderedList"),
      });
      const fmt = String(document.queryCommandValue("formatBlock") || "p").toLowerCase().replace(/[<>]/g, "");
      setBlock(BLOCKS.some((b) => b.value === fmt) ? fmt : "p");
    }
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, []);

  function focusEditor() {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const r = savedRange.current;
    if (r) {
      const sel = document.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
    }
  }
  function saveSelection() {
    const sel = document.getSelection();
    if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  }
  function exec(cmd: string, arg?: string) {
    focusEditor();
    document.execCommand(cmd, false, arg);
    emit();
  }
  function insertHtml(html: string) {
    focusEditor();
    document.execCommand("insertHTML", false, html);
    emit();
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    if (next === "code") {
      setCode(formatHtml(ref.current?.innerHTML ?? value));
    } else {
      onChange(code);
      requestAnimationFrame(() => {
        if (ref.current) ref.current.innerHTML = code;
      });
    }
    setInsert(null);
    setMode(next);
  }

  function inlineCode() {
    focusEditor();
    const text = document.getSelection()?.toString() ?? "";
    insertHtml(`<code>${esc(text || "code")}</code>&nbsp;`);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-input bg-card">
      {/* Tabs — like WordPress's Visual / Code */}
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-2 pt-2">
        <div role="tablist" aria-label="Editor mode" className="flex gap-1">
          {(["visual", "code"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={cn(
                "min-h-11 rounded-t-lg border border-b-0 px-3 text-sm font-medium sm:min-h-9",
                mode === m ? "border-input bg-card text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "visual" ? "Visual" : "Code"}
            </button>
          ))}
        </div>
        <span className="hidden pb-2 text-[11px] text-muted-foreground sm:block">
          {mode === "visual" ? "Formatting toolbar · Ctrl+B / I / U" : "Raw HTML — iframes & video tags allowed"}
        </span>
      </div>

      {mode === "visual" ? (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-0.5 border-b p-1.5" onMouseDown={(e) => {
            // Keep the editor's selection when clicking toolbar buttons.
            if ((e.target as HTMLElement).closest("button")) e.preventDefault();
          }}>
            <select
              aria-label="Text style"
              value={block}
              onMouseDown={saveSelection}
              onChange={(e) => {
                setBlock(e.target.value);
                exec("formatBlock", `<${e.target.value}>`);
              }}
              className="mr-1 h-11 rounded-lg border border-input bg-transparent px-2 text-sm sm:h-8"
            >
              {BLOCKS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
            <Tool icon={Bold} label="Bold" on={active.bold} onClick={() => exec("bold")} />
            <Tool icon={Italic} label="Italic" on={active.italic} onClick={() => exec("italic")} />
            <Tool icon={Underline} label="Underline" on={active.underline} onClick={() => exec("underline")} />
            <Tool icon={Strikethrough} label="Strikethrough" on={active.strikeThrough} onClick={() => exec("strikeThrough")} />
            <Sep />
            <Tool icon={List} label="Bulleted list" on={active.insertUnorderedList} onClick={() => exec("insertUnorderedList")} />
            <Tool icon={ListOrdered} label="Numbered list" on={active.insertOrderedList} onClick={() => exec("insertOrderedList")} />
            <Sep />
            <Tool icon={Link2} label="Insert link" on={insert === "link"} onClick={() => { saveSelection(); setInsert(insert === "link" ? null : "link"); }} />
            <Tool icon={Unlink} label="Remove link" onClick={() => exec("unlink")} />
            <Tool icon={Code} label="Inline code" onClick={inlineCode} />
            <Tool icon={Minus} label="Horizontal line" onClick={() => exec("insertHorizontalRule")} />
            <Tool icon={ImageIcon} label="Insert image" on={insert === "image"} onClick={() => { saveSelection(); setInsert(insert === "image" ? null : "image"); }} />
            <Tool icon={Video} label="Embed video" on={insert === "video"} onClick={() => { saveSelection(); setInsert(insert === "video" ? null : "video"); }} />
            <Sep />
            <Tool icon={Undo2} label="Undo" onClick={() => exec("undo")} />
            <Tool icon={Redo2} label="Redo" onClick={() => exec("redo")} />
            <Tool icon={Eraser} label="Clear formatting" onClick={() => { exec("removeFormat"); exec("formatBlock", "<p>"); }} />
          </div>

          {insert && (
            <InsertPanel
              kind={insert}
              selectedText={savedRange.current?.toString() ?? ""}
              onCancel={() => setInsert(null)}
              onInsert={(html, link) => {
                setInsert(null);
                if (link) {
                  focusEditor();
                  if (document.getSelection()?.toString()) exec("createLink", link);
                  else insertHtml(html);
                } else insertHtml(html);
              }}
            />
          )}

          <div
            ref={ref}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label="Guide content"
            data-placeholder={placeholder}
            onInput={emit}
            // New lines become <p> paragraphs (Chrome's default is <div>).
            onFocus={() => {
              document.execCommand("defaultParagraphSeparator", false, "p");
              // An empty editor starts inside a paragraph, so the first line is a <p> too.
              const el = ref.current;
              if (el && !el.innerHTML.trim()) {
                el.innerHTML = "<p><br></p>";
                const range = document.createRange();
                range.setStart(el.firstChild!, 0);
                range.collapse(true);
                const sel = document.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
              }
            }}
            onBlur={saveSelection}
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
            className={cn(
              "guide-content min-h-80 max-h-[70vh] overflow-y-auto px-4 py-3 outline-none",
              "empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
            )}
          />
        </>
      ) : (
        <textarea
          aria-label="Guide HTML"
          value={code}
          spellCheck={false}
          onChange={(e) => {
            setCode(e.target.value);
            onChange(e.target.value);
          }}
          className="block min-h-80 w-full resize-y bg-transparent px-4 py-3 font-mono text-[13px] leading-relaxed outline-none"
          style={{ height: "60vh" }}
          placeholder={'<h2>Section title</h2>\n<p>Text…</p>\n<iframe src="https://www.youtube.com/embed/VIDEO_ID"></iframe>'}
        />
      )}
    </div>
  );
}

function Tool({
  icon: Icon,
  label,
  on,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  on?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      title={label}
      className={cn(
        "flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:size-8",
        on && "bg-primary/10 text-primary",
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

function Sep() {
  return <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />;
}

/** Inline form for links / images / videos (no browser prompt; works on touch). */
function InsertPanel({
  kind,
  selectedText,
  onCancel,
  onInsert,
}: {
  kind: "link" | "image" | "video";
  selectedText: string;
  onCancel: () => void;
  /** html to insert; for links also the URL (to wrap a selection instead). */
  onInsert: (html: string, link?: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState(kind === "link" ? selectedText : "");
  const [error, setError] = useState("");

  function submit() {
    const u = url.trim();
    if (kind === "link") {
      if (!(isAppPath(u) || isHttpUrl(u) || /^mailto:[^\s@]+@[^\s@]+$/i.test(u))) {
        return setError("Use an app path like /settings?tab=ai, an https:// link, or mailto:");
      }
      const label = text.trim() || u;
      return onInsert(`<a href="${esc(u)}">${esc(label)}</a>&nbsp;`, u);
    }
    if (kind === "image") {
      if (!(isAppPath(u) || /^https:\/\//i.test(u))) return setError("Image URL must start with https:// or / (a file in /public).");
      if (!text.trim()) return setError("Describe the image for screen readers.");
      return onInsert(`<figure><img src="${esc(u)}" alt="${esc(text.trim())}"></figure><p><br></p>`);
    }
    // video
    const embed = videoEmbedUrl(u);
    if (embed) {
      return onInsert(`<iframe src="${esc(embed)}" title="${esc(text.trim() || "Video")}" allowfullscreen></iframe><p><br></p>`);
    }
    if (/^https:\/\/\S+\.(mp4|webm)(\?\S*)?$/i.test(u)) {
      return onInsert(`<video src="${esc(u)}" controls></video><p><br></p>`);
    }
    setError("Paste a YouTube, Vimeo or Loom link, or an https:// .mp4 / .webm file.");
  }

  const copy = {
    link: { url: "Link — /settings?tab=ai or https://…", text: "Text to show (optional if text is selected)" },
    image: { url: "Image URL — https://… or /guides/screenshot.png", text: "What the image shows (alt text)" },
    video: { url: "YouTube / Vimeo / Loom link, or an https .mp4", text: "Video title (optional)" },
  }[kind];

  return (
    <div className="space-y-2 border-b bg-muted/30 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          autoFocus
          value={url}
          inputMode="url"
          onChange={(e) => {
            setUrl(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submit())}
          placeholder={copy.url}
          aria-label={copy.url}
        />
        <Input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submit())}
          placeholder={copy.text}
          aria-label={copy.text}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={submit}>
          Insert {kind}
        </Button>
      </div>
    </div>
  );
}
