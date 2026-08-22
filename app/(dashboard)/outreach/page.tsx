"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getLead } from "@/lib/mock-data";
import { useOutreach } from "@/lib/mock-store";
import { OUTREACH_KIND_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function OutreachPage() {
  const rows = useOutreach()
    .map((m) => ({ message: m, lead: getLead(m.leadId) }))
    .filter((row) => row.lead);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h1 className="text-lg font-semibold tracking-tight">Outreach</h1>
        <p className="hidden text-sm text-muted-foreground sm:block">
          Drafted and sent messages across your leads.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
          No messages yet.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {rows.map(({ message, lead }) => (
            <li key={message.id}>
              <Link
                href={`/leads/${lead!.id}`}
                className="block rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{lead!.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {OUTREACH_KIND_LABELS[message.kind]} · {message.channel}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        message.status === "sent"
                          ? "bg-status-applied text-status-applied-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {message.status === "sent" ? "Sent" : "Draft"}
                    </span>
                    <ChevronRight
                      className="size-4 text-muted-foreground"
                      aria-hidden
                    />
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-sm whitespace-pre-line text-muted-foreground">
                  {message.sentBody ?? message.draftBody}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
