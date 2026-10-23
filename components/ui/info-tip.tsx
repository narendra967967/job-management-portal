"use client"

// Small "ⓘ" explainer for helper text that would otherwise sit under a control
// as an always-visible line. Opens on hover (desktop) AND on tap/click or
// keyboard (touch screens can't hover — CLAUDE.md: no hover-only interactions).
// Pass `trigger` to use a text label instead of the icon.

import * as React from "react"
import { Popover } from "@base-ui/react/popover"
import { Info } from "lucide-react"

import { cn } from "@/lib/utils"

function InfoTip({
  children,
  label = "More info",
  trigger,
  side = "top",
  className,
}: {
  children: React.ReactNode
  /** Accessible name for the icon trigger. */
  label?: string
  /** Visible trigger content; defaults to an info icon. */
  trigger?: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
  className?: string
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={120}
        aria-label={trigger ? undefined : label}
        className={cn(
          // Small visual, ≥44px hit area via the pseudo-element.
          "relative inline-flex items-center gap-1 rounded-md text-muted-foreground outline-none after:absolute after:-inset-2.5 after:content-[''] hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:text-foreground",
          className,
        )}
      >
        {trigger ?? <Info className="size-3.5" aria-hidden />}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side={side} sideOffset={8} collisionPadding={12} className="isolate z-50">
          <Popover.Popup className="max-w-[min(18rem,calc(100vw-2rem))] origin-(--transform-origin) rounded-lg bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

export { InfoTip }
