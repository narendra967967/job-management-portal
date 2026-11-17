import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

// Marks the interview screen while it runs on the stand-in interviewer
// (lib/mock-interviews/standin.ts), with links that preview its other states.
// Removed in R1.5 with the stand-in.

export function StandInBanner({ previews, className }: { previews?: { label: string; href: string; active?: boolean }[]; className?: string }) {
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
        Practice run: the AI interviewer isn&apos;t connected yet, and answers aren&apos;t saved
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
