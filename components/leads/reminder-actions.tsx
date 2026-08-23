"use client";

import { useState } from "react";
import { Check, Clock3, RotateCcw, Trash2 } from "lucide-react";
import type { Reminder } from "@/lib/types";
import {
  completeReminder,
  deleteReminder,
  snoozeReminder,
} from "@/lib/mock-store";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
}

const iconBtn =
  "inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/** Per-reminder actions: Mark done · Snooze/Reschedule · Delete (or Reopen). */
export function ReminderActions({ reminder }: { reminder: Reminder }) {
  const done = reminder.outcome !== "pending";
  const [custom, setCustom] = useState("");

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {done ? (
        <button
          type="button"
          aria-label="Reopen reminder"
          title="Reopen"
          onClick={() => snoozeReminder(reminder.id, addDays(3))}
          className={iconBtn}
        >
          <RotateCcw className="size-4" aria-hidden />
        </button>
      ) : (
        <>
          <button
            type="button"
            aria-label="Mark reminder done"
            title="Mark done"
            onClick={() => completeReminder(reminder.id)}
            className={`${iconBtn} hover:text-status-applied-foreground`}
          >
            <Check className="size-4" aria-hidden />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Snooze or reschedule"
              title="Snooze / reschedule"
              className={iconBtn}
            >
              <Clock3 className="size-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Snooze / reschedule</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => snoozeReminder(reminder.id, addDays(1))}
              >
                Tomorrow
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => snoozeReminder(reminder.id, addDays(3))}
              >
                In 3 days
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => snoozeReminder(reminder.id, addDays(7))}
              >
                In a week
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="p-1.5">
                <span className="mb-1 block px-1 text-[11px] font-medium text-muted-foreground">
                  Custom date
                </span>
                <Input
                  type="date"
                  value={custom}
                  min={iso(new Date())}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCustom(v);
                    if (v) snoozeReminder(reminder.id, v);
                  }}
                  className="h-9"
                />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
      <button
        type="button"
        aria-label="Delete reminder"
        title="Delete"
        onClick={() => deleteReminder(reminder.id)}
        className={`${iconBtn} hover:text-destructive`}
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </div>
  );
}
