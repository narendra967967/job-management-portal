import Image from "next/image";
import { cn } from "@/lib/utils";

/** JMP logo: the planet badge mark plus optional full name. */
export function Logo({
  showName = true,
  className,
}: {
  showName?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/logo.png"
        alt="JMP"
        width={32}
        height={32}
        priority
        className="size-8 shrink-0 rounded-full"
      />
      {showName && (
        <span className="text-sm font-medium text-foreground">
          Job Management Portal
        </span>
      )}
    </div>
  );
}
