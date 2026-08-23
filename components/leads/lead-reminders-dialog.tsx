"use client";

import { Bell, BellPlus, Clock } from "lucide-react";
import {
  REMINDER_OUTCOME_LABELS,
  isJobOpen,
  type JobLead,
} from "@/lib/types";
import { useLeadStatus, useRemindersForLead } from "@/lib/mock-store";
import { ReminderActions } from "@/components/leads/reminder-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * All reminders for one lead: mark done, snooze/reschedule, delete. "Add
 * reminder" opens the add dialog (stacked above) and is disabled once the job
 * is closed/discarded. Reads from the store so changes reflect live.
 */
export function LeadRemindersDialog({
  lead,
  open,
  onOpenChange,
  onAddReminder,
}: {
  lead: JobLead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddReminder: () => void;
}) {
  const reminders = useRemindersForLead(lead.id);
  const { status } = useLeadStatus(lead.id);
  const jobOpen = isJobOpen(status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Bell className="size-4" aria-hidden />
            </span>
            Reminders
          </DialogTitle>
          <DialogDescription>
            {lead.company} · {lead.title}
          </DialogDescription>
        </DialogHeader>

        {reminders.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-8 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Clock className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-medium">No reminders yet</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Add one, or mark a message sent to schedule a follow-up
              automatically.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {reminders.map((r) => {
              const done = r.outcome !== "pending";
              return (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-xl border bg-card p-3"
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-md",
                      done
                        ? "bg-status-applied text-status-applied-foreground"
                        : "bg-status-reviewing text-status-reviewing-foreground",
                    )}
                  >
                    <Clock className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm font-medium",
                        done && "text-muted-foreground line-through",
                      )}
                    >
                      {r.manual
                        ? r.label || "Manual reminder"
                        : `Reminder ${r.sequence}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {done ? REMINDER_OUTCOME_LABELS[r.outcome] : `Due ${r.dueDate}`}
                    </p>
                  </div>
                  <ReminderActions reminder={r} />
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={onAddReminder}
            disabled={!jobOpen}
            title={jobOpen ? "Add reminder" : "Reopen this job to add reminders"}
          >
            <BellPlus className="size-4" aria-hidden />
            Add reminder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
