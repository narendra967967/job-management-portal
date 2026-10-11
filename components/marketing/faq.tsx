"use client";

// FAQ accordion for the landing page — single-open (opening one closes the rest),
// smooth height animation via the grid-rows 1fr↔0fr trick (honored by the
// reduced-motion guard).

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const toggle = (i: number) => setOpenIdx((cur) => (cur === i ? null : i));

  return (
    <div className="mx-auto mt-12 max-w-3xl divide-y overflow-hidden rounded-2xl border bg-card">
      {items.map((it, i) => {
        const isOpen = openIdx === i;
        return (
          <div key={it.q}>
            <button
              type="button"
              onClick={() => toggle(i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40"
            >
              <span className="text-sm font-medium">{it.q}</span>
              <ChevronDown
                className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")}
                aria-hidden
              />
            </button>
            <div className={cn("grid transition-[grid-template-rows] duration-200 ease-out", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
              <div className="overflow-hidden">
                <p className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">{it.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
