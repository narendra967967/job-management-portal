import { cn } from "@/lib/utils";

/** App logo: the admin-managed branding mark (falls back to the bundled default)
 *  plus an optional wordmark. Uses a plain <img> so admin updates show without
 *  Next's image-optimizer cache in the way. */
export function Logo({
  showName = true,
  className,
}: {
  showName?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/api/branding/logo"
        alt="Logo"
        width={32}
        height={32}
        className="size-8 shrink-0 rounded-full object-cover"
      />
      {showName && (
        <span className="text-sm font-medium text-foreground">
          Job Management Portal
        </span>
      )}
    </div>
  );
}
