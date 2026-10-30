import Link from "next/link";
import { ArrowRight, Briefcase } from "lucide-react";

// Slim strip under the dashboard header while the career profile is incomplete
// (fit scores and drafts use it, and the résumé ATS check needs it). Rendered by the dashboard layout; disappears
// once every required item is done.
export function CareerProfileNotice({ percent }: { percent: number }) {
  return (
    <Link
      href="/settings?tab=career"
      className="flex min-h-11 shrink-0 items-center gap-2 border-b border-amber-200/70 bg-amber-50/80 px-4 text-xs text-amber-900 backdrop-blur-md transition-colors hover:bg-amber-100/80 md:px-6"
    >
      <Briefcase className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">Career profile {percent}% complete</span>
        <span className="hidden sm:inline"> — finish it for sharper fit scores and drafts.</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 font-medium">
        Complete
        <ArrowRight className="size-3.5" aria-hidden />
      </span>
    </Link>
  );
}
