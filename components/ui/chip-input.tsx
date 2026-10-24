"use client";

// Multi-value text input shown as removable chips (skills, languages, roles…).
// Enter or comma adds what's typed; Backspace on an empty field removes the last
// chip. Suggestions sit underneath as tappable "+ value" buttons — shown up
// front for short curated lists, or only while typing for long ones (countries).

import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChipInput({
  value,
  onChange,
  suggestions = [],
  suggestWhileTypingOnly = false,
  max,
  maxLength = 60,
  placeholder = "Type and press Enter",
  ariaLabel,
  invalid,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: readonly string[];
  /** Long lists: only show suggestions that match what's being typed. */
  suggestWhileTypingOnly?: boolean;
  max?: number;
  maxLength?: number;
  placeholder?: string;
  ariaLabel: string;
  invalid?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const listId = useId();
  const full = max != null && value.length >= max;

  /** Add one or more comma-separated values (typed or pasted). */
  function add(raw: string) {
    let next = value;
    for (const part of raw.split(",")) {
      const v = part.trim().replace(/\s+/g, " ").slice(0, maxLength);
      if (!v || next.some((x) => x.toLowerCase() === v.toLowerCase())) continue;
      if (max != null && next.length >= max) break;
      next = [...next, v];
    }
    if (next !== value) onChange(next);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      // Read the field itself: with fast typing, `draft` can lag a keystroke.
      add(e.currentTarget.value);
    } else if (e.key === "Backspace" && !e.currentTarget.value && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  const shown = useMemo(() => {
    const q = draft.trim().toLowerCase();
    if (suggestWhileTypingOnly && !q) return [];
    return suggestions
      .filter((s) => !value.some((x) => x.toLowerCase() === s.toLowerCase()))
      .filter((s) => !q || s.toLowerCase().includes(q))
      .slice(0, 8);
  }, [draft, suggestions, suggestWhileTypingOnly, value]);

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          "flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-white/50 p-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 sm:min-h-9",
          invalid && "border-destructive ring-3 ring-destructive/20",
        )}
      >
        {value.map((v) => (
          <span
            key={v}
            className="inline-flex max-w-full items-center gap-1 rounded-md bg-primary/10 py-0.5 pr-1 pl-2 text-xs font-medium text-primary"
          >
            <span className="truncate">{v}</span>
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== v))}
              aria-label={`Remove ${v}`}
              className="relative flex size-5 shrink-0 items-center justify-center rounded text-primary/70 after:absolute after:-inset-2 after:content-[''] hover:bg-primary/15 hover:text-primary"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        {!full && (
          <input
            value={draft}
            onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setDraft(e.target.value))}
            onKeyDown={onKeyDown}
            onBlur={(e) => add(e.currentTarget.value)}
            placeholder={value.length ? "" : placeholder}
            aria-label={ariaLabel}
            aria-describedby={shown.length ? listId : undefined}
            maxLength={maxLength}
            className="h-8 min-w-32 flex-1 bg-transparent px-1 text-base outline-none placeholder:text-muted-foreground md:text-sm"
          />
        )}
      </div>
      {(shown.length > 0 || max != null) && (
        <div className="flex flex-wrap items-center gap-1.5" id={listId}>
          {!full &&
            shown.map((s) => (
              <button
                key={s}
                type="button"
                // mousedown: add before the input's blur commits the draft.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(s)}
                className="inline-flex min-h-10 items-center gap-1 rounded-md border border-dashed border-border bg-white/40 px-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground sm:min-h-8"
              >
                <Plus className="size-3" aria-hidden />
                {s}
              </button>
            ))}
          {max != null && (
            <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
              {value.length}/{max}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
