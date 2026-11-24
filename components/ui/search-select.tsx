"use client";

import { useMemo } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// A dropdown you can type into: click it to see every option, or type to narrow
// the list. Built on the UI library's Combobox (like the lead picker), and
// styled exactly like the app's text box (height, corners, border, leading
// icon, placeholder), so the two sit side by side without looking different.

interface Option {
  value: string;
  label: string;
}

export function SearchSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Pick one",
  icon: Icon,
  ariaLabel,
  invalid,
  emptyText = "Nothing matches that.",
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** Plain strings (value and label are the same) or { value, label }. */
  options: readonly (string | Option)[];
  placeholder?: string;
  icon?: LucideIcon;
  ariaLabel?: string;
  invalid?: boolean;
  emptyText?: string;
  className?: string;
}) {
  const items = useMemo<Option[]>(() => options.map((o) => (typeof o === "string" ? { value: o, label: o } : o)), [options]);
  const selected = items.find((i) => i.value === value) ?? null;

  return (
    <Combobox.Root
      items={items}
      value={selected}
      onValueChange={(v) => onChange((v as Option | null)?.value ?? "")}
      isItemEqualToValue={(a: Option, b: Option) => a.value === b.value}
      autoHighlight
    >
      <Combobox.InputGroup
        className={cn(
          // The same look as components/ui/input.tsx at the form's size.
          "relative flex h-11 w-full items-center rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 sm:h-10 dark:bg-input/30",
          invalid && "border-destructive ring-3 ring-destructive/20",
          className,
        )}
      >
        {Icon && <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />}
        <Combobox.Input
          id={id}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          className={cn(
            "h-full w-full min-w-0 rounded-lg border-0 bg-transparent pr-10 text-base outline-none placeholder:text-muted-foreground md:text-sm",
            Icon ? "pl-9" : "pl-2.5",
          )}
        />
        <Combobox.Trigger
          aria-label={ariaLabel ? `Show all: ${ariaLabel}` : "Show all options"}
          className="absolute right-1 flex size-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground sm:size-8"
        >
          <ChevronDown className="size-4" aria-hidden />
        </Combobox.Trigger>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="z-50 outline-none">
          <Combobox.Popup className="w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 transition-[scale,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <Combobox.Empty>
              <p className="px-3 py-3 text-sm text-muted-foreground">{emptyText}</p>
            </Combobox.Empty>
            <Combobox.List className="max-h-[min(18rem,var(--available-height))] overflow-y-auto overscroll-contain py-1 outline-0 data-empty:p-0">
              {(item: Option) => (
                <Combobox.Item
                  key={item.value}
                  value={item}
                  className="grid min-h-11 cursor-default grid-cols-[1rem_1fr] items-center gap-2 px-2.5 py-2 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground sm:min-h-9"
                >
                  <Combobox.ItemIndicator className="col-start-1">
                    <Check className="size-4 text-primary" aria-hidden />
                  </Combobox.ItemIndicator>
                  <span className="col-start-2 truncate">{item.label}</span>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
