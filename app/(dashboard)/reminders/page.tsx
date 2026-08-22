"use client";

import Link from "next/link";
import { Clock, ChevronRight } from "lucide-react";
import { getLead } from "@/lib/mock-data";
import { useReminders } from "@/lib/mock-store";
import { REMINDER_OUTCOME_LABELS } from "@/lib/types";

export default function RemindersPage() {
  const rows = useReminders()
    .map((r) => ({ reminder: r, lead: getLead(r.leadId) }))
    .filter((row) => row.lead);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h1 className="text-lg font-semibold tracking-tight">Reminders</h1>
        <p className="hidden text-sm text-muted-foreground sm:block">
          Follow-ups scheduled after a message is marked sent.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
          No reminders yet.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {rows.map(({ reminder, lead }) => (
            <li key={reminder.id}>
              <Link
                href={`/leads/${lead!.id}`}
                className="flex items-center gap-3 rounded-xl border bg-card p-3.5 transition-colors hover:border-primary/40"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-status-reviewing text-status-reviewing-foreground">
                  <Clock className="size-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{lead!.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {lead!.company} · Reminder {reminder.sequence} · due{" "}
                    {reminder.dueDate}
                  </p>
                </div>
                <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {REMINDER_OUTCOME_LABELS[reminder.outcome]}
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
