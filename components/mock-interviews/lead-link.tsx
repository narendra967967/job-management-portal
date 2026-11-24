import Link from "next/link";
import { Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

/** "For: Role at Company · Open lead" on interview history and reports. No
 *  link once the lead is deleted, or while lead pages are locked (limited mode). */
export function LeadLink({
  lead,
  limited,
  className,
}: {
  lead: { id: string | null; label: string };
  limited: boolean;
  className?: string;
}) {
  return (
    <p className={cn("flex items-start gap-1.5 text-xs text-muted-foreground", className)}>
      <Briefcase className="mt-px size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0">
        For <span className="font-medium text-foreground">{lead.label}</span>
        {lead.id && !limited && (
          <>
            {" · "}
            <Link href={`/leads/${lead.id}`} className="font-medium whitespace-nowrap text-primary hover:underline">
              Open lead
            </Link>
          </>
        )}
      </span>
    </p>
  );
}
