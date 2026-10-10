import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { planBadgeClass } from "@/lib/plan-accent";

// Admin-only plan pill (kept separate from the user app's PlanBadge; shares only
// the neutral accent→class map in lib/plan-accent). Tinted with the plan's accent.
export function PlanBadge({
  name,
  accent,
  className,
}: {
  name: string;
  accent?: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-[12rem] items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        planBadgeClass(accent),
        className,
      )}
    >
      <Crown className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{name}</span>
    </span>
  );
}
