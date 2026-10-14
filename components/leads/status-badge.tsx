import { cn } from "@/lib/utils";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/types";

const statusClasses: Record<LeadStatus, string> = {
  new: "bg-status-new text-status-new-foreground",
  shortlisted: "bg-status-shortlisted text-status-shortlisted-foreground",
  applied: "bg-status-applied text-status-applied-foreground",
  interview: "bg-status-interview text-status-interview-foreground",
  "offer-received": "bg-status-offer-received text-status-offer-received-foreground",
  discarded: "bg-status-discarded text-status-discarded-foreground",
  closed: "bg-status-closed text-status-closed-foreground",
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
