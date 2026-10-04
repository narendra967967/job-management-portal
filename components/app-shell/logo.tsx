import { cn } from "@/lib/utils";

/** App logo: the admin-managed branding mark (falls back to the bundled default)
 *  plus an optional wordmark. Uses a plain <img> so admin updates show without
 *  Next's image-optimizer cache in the way. */
export function Logo({
  showName = true,
  name = "Job Management Portal",
  className,
}: {
  showName?: boolean;
  /** Wordmark text — pass the configured app name; defaults to the product name. */
  name?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/api/branding/logo"
        alt={name}
        width={32}
        height={32}
        className="size-8 shrink-0 rounded-full object-cover"
      />
      {showName && (
        <span className="truncate text-sm font-medium text-foreground">{name}</span>
      )}
    </div>
  );
}
