"use client";

import {
  Sparkles,
  UserPlus,
  Send,
  Clock,
  CircleDot,
  CircleCheck,
} from "lucide-react";
import { useLeadTimeline, type TimelineKind } from "@/lib/mock-store";
import { cn } from "@/lib/utils";

const KIND_META: Record<
  TimelineKind,
  { icon: typeof Sparkles; dot: string }
> = {
  captured: { icon: Sparkles, dot: "bg-ai-muted text-ai" },
  "contact-added": { icon: UserPlus, dot: "bg-primary/10 text-primary" },
  message: { icon: Send, dot: "bg-status-applied text-status-applied-foreground" },
  reminder: {
    icon: Clock,
    dot: "bg-status-reviewing text-status-reviewing-foreground",
  },
  "reminder-resolved": {
    icon: CircleCheck,
    dot: "bg-status-applied text-status-applied-foreground",
  },
  status: { icon: CircleDot, dot: "bg-muted text-muted-foreground" },
};

/** Per-lead activity timeline (FR-6.2): captured → contacts → messages →
 *  reminders → current status, in date order. */
export function LeadTimeline({ leadId }: { leadId: string }) {
  const events = useLeadTimeline(leadId);

  return (
    <ol className="relative space-y-4 pl-2">
      {events.map((e, i) => {
        const meta = KIND_META[e.kind];
        const Icon = meta.icon;
        const last = i === events.length - 1;
        // Only date-bearing events show a date; the closing status row doesn't.
        const showDate = e.kind !== "status";
        return (
          <li key={e.id} className="relative flex gap-3">
            {/* Connector line down to the next event */}
            {!last && (
              <span
                className="absolute top-8 left-[15px] h-[calc(100%-8px)] w-px bg-border"
                aria-hidden
              />
            )}
            <span
              className={cn(
                "z-10 flex size-8 shrink-0 items-center justify-center rounded-full",
                meta.dot,
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium">{e.title}</p>
              {e.detail && (
                <p className="truncate text-xs text-muted-foreground">
                  {e.detail}
                </p>
              )}
              {showDate && (
                <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                  {e.date}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
