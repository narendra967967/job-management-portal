import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { planBadgeClass } from "@/lib/plan-accent";

/** A small pill showing the user's plan, tinted with the plan's chosen accent. */
export function PlanBadge({
  name,
  accent,
  className,
  icon = true,
}: {
  name: string;
  accent?: string | null;
  className?: string;
  icon?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-[12rem] items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        planBadgeClass(accent),
        className,
      )}
    >
      {icon && <Crown className="size-3 shrink-0" aria-hidden />}
      <span className="truncate">{name}</span>
    </span>
  );
}
