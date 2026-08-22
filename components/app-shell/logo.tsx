import { cn } from "@/lib/utils";

/** JMP wordmark: the "JMP" tile plus optional full name. */
export function Logo({
  showName = true,
  className,
}: {
  showName?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[oklch(0.56_0.2_305)] text-[11px] font-semibold tracking-wide text-primary-foreground shadow-sm ring-1 ring-primary/20">
        JMP
      </span>
      {showName && (
        <span className="text-sm font-medium text-foreground">
          Job Management Portal
        </span>
      )}
    </div>
  );
}
