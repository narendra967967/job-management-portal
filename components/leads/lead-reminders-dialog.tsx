"use client";

import { Bell, BellPlus, Clock, Trash2 } from "lucide-react";
import { REMINDER_OUTCOME_LABELS, type JobLead } from "@/lib/types";
import { deleteReminder, useRemindersForLead } from "@/lib/mock-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * All reminders for one lead, with delete. "Add reminder" opens the existing
 * add dialog (stacked above, via the card's action-dialog opener). Reads from
 * the in-memory store so adds/deletes reflect live (Phase 3 → Server Actions).
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
            {reminders.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-xl border bg-card p-3"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-status-reviewing text-status-reviewing-foreground">
                  <Clock className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {r.manual
                      ? r.label || "Manual reminder"
                      : `Reminder ${r.sequence}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Due {r.dueDate} · {REMINDER_OUTCOME_LABELS[r.outcome]}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Delete reminder"
                  title="Delete reminder"
                  onClick={() => deleteReminder(r.id)}
                  className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={onAddReminder}>
            <BellPlus className="size-4" aria-hidden />
            Add reminder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
