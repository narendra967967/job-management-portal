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
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-[11px] font-medium tracking-wide text-primary-foreground">
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
