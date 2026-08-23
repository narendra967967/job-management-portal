"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import { getLead } from "@/lib/mock-data";
import { useReminders } from "@/lib/mock-store";
import { ReminderActions } from "@/components/leads/reminder-actions";
import { cn } from "@/lib/utils";

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
          {rows.map(({ reminder, lead }) => {
            const done = reminder.outcome !== "pending";
            return (
              <li
                key={reminder.id}
                className="flex items-center gap-3 rounded-xl border bg-card p-3.5 transition-colors hover:border-primary/40"
              >
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full",
                    done
                      ? "bg-status-applied text-status-applied-foreground"
                      : "bg-status-reviewing text-status-reviewing-foreground",
                  )}
                >
                  <Clock className="size-5" aria-hidden />
                </div>
                <Link href={`/leads/${lead!.id}`} className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-sm font-medium",
                      done && "text-muted-foreground line-through",
                    )}
                  >
                    {lead!.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {lead!.company} ·{" "}
                    {done ? "Done" : `Reminder ${reminder.sequence} · due ${reminder.dueDate}`}
                  </p>
                </Link>
                <ReminderActions reminder={reminder} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
