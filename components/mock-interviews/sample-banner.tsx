import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

// PHASE R1.2: marks a screen running on sample data, with optional links that
// preview its other states. Removed with the sample data in R1.4.

export function SampleBanner({ previews, className }: { previews?: { label: string; href: string; active?: boolean }[]; className?: string }) {
  return (
    <div
      role="note"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-dashed border-amber-400/70 bg-amber-50/80 px-3 py-2 text-xs text-amber-900",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 font-medium">
        <FlaskConical className="size-3.5" aria-hidden />
        Sample data: nothing here is saved yet
      </span>
      {previews && previews.length > 0 && (
        <span className="flex flex-wrap items-center gap-1">
          Preview:
          {previews.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              aria-current={p.active ? "true" : undefined}
              className={cn(
                "inline-flex min-h-8 items-center rounded-md px-2 underline-offset-2 hover:underline",
                p.active ? "bg-amber-200/70 font-semibold" : "",
              )}
            >
              {p.label}
            </Link>
          ))}
        </span>
      )}
    </div>
  );
}
