import * as React from "react";
import { cn } from "@/lib/utils";

// Tiny, dependency-free Markdown renderer for AI output (summaries, drafts).
// Handles just the subset the model emits — ATX headings (#..######), unordered
// lists (-, *), blank-line paragraphs, and inline **bold**. It never renders raw
// HTML (only text nodes and <strong>), so there's no injection surface, and no
// need to pull in a full Markdown library.

/** Does this text contain any Markdown worth rendering? If not, show it plain. */
export function looksLikeMarkdown(text: string): boolean {
  return /(^#{1,6}\s)|(^\s*[-*]\s)|(\*\*[^*]+\*\*)/m.test(text);
}

/** Inline pass: split on **bold** into text + <strong> nodes. */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <strong key={key++} className="font-semibold text-foreground">
        {m[1]}
      </strong>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
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
  let key = 0;

  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={key++} className="my-1.5 list-disc space-y-1 pl-5">
          {list}
        </ul>,
      );
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
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
      list.push(<li key={key++}>{renderInline(bullet[1])}</li>);
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
