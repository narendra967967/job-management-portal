"use client";

import { useMemo } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, Search, X } from "lucide-react";
import type { JobLead } from "@/lib/types";
import { cn } from "@/lib/utils";

// Pick one of the user's leads by typing: the list narrows as you type a title
// or company. Built on the UI library's Combobox (already installed), styled
// like the app's Select. Interview-stage leads are listed first and tagged.

interface LeadItem {
  value: string;
  label: string;
  company: string;
  title: string;
  interview: boolean;
}

export function LeadPicker({
  leads,
  value,
  onChange,
  invalid,
}: {
  leads: JobLead[];
  value: string;
  onChange: (leadId: string) => void;
  invalid?: boolean;
}) {
  const items = useMemo<LeadItem[]>(
    () =>
      leads.map((l) => ({
        value: l.id,
        label: `${l.title} · ${l.company}`,
        title: l.title,
        company: l.company,
        interview: l.status === "interview",
      })),
    [leads],
  );
  const selected = items.find((i) => i.value === value) ?? null;

  return (
    <Combobox.Root
      items={items}
      value={selected}
      onValueChange={(v) => onChange((v as LeadItem | null)?.value ?? "")}
      isItemEqualToValue={(a: LeadItem, b: LeadItem) => a.value === b.value}
    >
      <Combobox.InputGroup
        className={cn(
          "relative flex h-11 w-full items-center rounded-lg border border-input bg-white/50 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 sm:h-9",
          invalid && "border-destructive",
        )}
      >
        <Search className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground" aria-hidden />
        <Combobox.Input
          placeholder="Search your leads by title or company"
          aria-label="Lead"
          className="h-full w-full min-w-0 rounded-lg border-0 bg-transparent pr-16 pl-8 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="absolute right-1 flex items-center">
          {selected && (
            <Combobox.Clear
              aria-label="Clear the lead"
              className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground sm:size-7"
            >
              <X className="size-3.5" aria-hidden />
            </Combobox.Clear>
          )}
          <Combobox.Trigger
            aria-label="Show all leads"
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground sm:size-7"
          >
            <ChevronDown className="size-4" aria-hidden />
          </Combobox.Trigger>
        </div>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="z-50 outline-none">
          <Combobox.Popup className="w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 transition-[scale,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <Combobox.Empty>
              <p className="px-3 py-3 text-sm text-muted-foreground">No leads match that.</p>
            </Combobox.Empty>
            <Combobox.List className="max-h-[min(20rem,var(--available-height))] overflow-y-auto overscroll-contain py-1 outline-0 data-empty:p-0">
              {(item: LeadItem) => (
                <Combobox.Item
                  key={item.value}
                  value={item}
                  className="grid min-h-11 cursor-default grid-cols-[1rem_1fr] items-center gap-2 px-2.5 py-2 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground sm:min-h-9"
                >
                  <Combobox.ItemIndicator className="col-start-1">
                    <Check className="size-4 text-primary" aria-hidden />
                  </Combobox.ItemIndicator>
                  <span className="col-start-2 min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{item.title}</span>
                      {item.interview && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Interview</span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{item.company}</span>
                  </span>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
