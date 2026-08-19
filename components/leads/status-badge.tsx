import { cn } from "@/lib/utils";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/types";

const statusClasses: Record<LeadStatus, string> = {
  new: "bg-status-new text-status-new-foreground",
  reviewing: "bg-status-reviewing text-status-reviewing-foreground",
  applied: "bg-status-applied text-status-applied-foreground",
  discarded: "bg-status-discarded text-status-discarded-foreground",
};

export function StatusBadge({
  status,
  className,
}: {
  status: LeadStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        statusClasses[status],
        className,
      )}
    >
      {LEAD_STATUS_LABELS[status]}
    </span>
  );
}
