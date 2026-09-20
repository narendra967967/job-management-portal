import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format an ISO date/datetime for display. Reminders now carry a time, so show
 * date + time; a bare "YYYY-MM-DD" (legacy/date-only) shows just the date.
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return dateOnly
    ? d.toLocaleDateString(undefined, { dateStyle: "medium" })
    : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
