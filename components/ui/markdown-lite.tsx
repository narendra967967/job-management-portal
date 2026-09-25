import * as React from "react";
import { cn } from "@/lib/utils";

// Tiny, dependency-free Markdown renderer for AI output and user notes/JDs.
// Handles the subset the app produces: ATX headings (#..######), unordered
// (-, *) and ordered (1.) lists, blank-line paragraphs, and inline **bold**,
// *italic* / _italic_, `code`, and [links](https://…). It never renders raw
// HTML — only text nodes and a fixed set of elements, and links are restricted
// to http(s) — so there's no injection surface and no need for a full library.

/** Does this text contain any Markdown worth rendering? If not, show it plain. */
export function looksLikeMarkdown(text: string): boolean {
  return /(^#{1,6}\s)|(^\s*[-*]\s)|(^\s*\d+\.\s)|(\*\*[^*]+\*\*)|((?:\*|_)[^*_\n]+(?:\*|_))|(`[^`]+`)|(\[[^\]]+\]\(https?:\/\/[^)\s]+\))/m.test(
    text,
  );
}

// Inline patterns, matched by earliest position each step (bold before italic).
const INLINE = [
  { name: "bold", re: /\*\*([^*]+)\*\*/ },
  { name: "code", re: /`([^`]+)`/ },
  { name: "link", re: /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/ },
  { name: "em", re: /(\*|_)([^*_\n]+)\1/ },
] as const;

/** Inline pass: emit text + <strong>/<em>/<code>/<a> nodes. */
function renderInline(text: string, keyBase = 0): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let rest = text;
  let key = keyBase;

  while (rest) {
    let best: { name: string; m: RegExpExecArray } | null = null;
    for (const p of INLINE) {
      const m = p.re.exec(rest);
      if (m && (best === null || m.index < best.m.index)) {
        best = { name: p.name, m };
      }
    }
    if (!best) {
      nodes.push(rest);
      break;
    }
    const { name, m } = best;
    if (m.index > 0) nodes.push(rest.slice(0, m.index));
    if (name === "bold") {
      nodes.push(
        <strong key={key++} className="font-semibold text-foreground">
          {m[1]}
        </strong>,
      );
    } else if (name === "code") {
      nodes.push(
        <code
          key={key++}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
        >
          {m[1]}
        </code>,
      );
    } else if (name === "link") {
      nodes.push(
        <a
          key={key++}
          href={m[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80"
        >
          {m[1]}
        </a>,
      );
    } else {
      // em
      nodes.push(
        <em key={key++} className="italic">
          {m[2]}
        </em>,
      );
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return nodes;
}

export function MarkdownLite({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];
  let listType: "ul" | "ol" | null = null;
  let key = 0;

  const flushList = () => {
    if (list.length) {
      blocks.push(
        listType === "ol" ? (
          <ol key={key++} className="my-1.5 list-decimal space-y-1 pl-5">
            {list}
          </ol>
        ) : (
          <ul key={key++} className="my-1.5 list-disc space-y-1 pl-5">
            {list}
          </ul>
        ),
      );
      list = [];
      listType = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (heading) {
      flushList();
      const level = heading[1].length;
      blocks.push(
        <p
          key={key++}
          className={cn(
            "font-semibold text-foreground",
            blocks.length > 0 && "mt-3",
            level <= 2 ? "text-sm" : "text-[13px]",
          )}
        >
          {renderInline(heading[2])}
        </p>,
      );
    } else if (bullet) {
      if (listType === "ol") flushList();
      listType = "ul";
      list.push(<li key={key++}>{renderInline(bullet[1])}</li>);
    } else if (ordered) {
      if (listType === "ul") flushList();
      listType = "ol";
      list.push(<li key={key++}>{renderInline(ordered[1])}</li>);
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      blocks.push(
        <p key={key++} className={cn(blocks.length > 0 && "mt-1.5")}>
          {renderInline(line)}
        </p>,
      );
    }
  }
  flushList();

  return (
    <div className={cn("text-sm leading-relaxed break-words", className)}>
      {blocks}
    </div>
  );
}
