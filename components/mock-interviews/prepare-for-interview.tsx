"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { aiInterviewsOpenAction } from "@/actions/mock-interviews";
import { cn } from "@/lib/utils";

// On a lead at the Interview stage: practice for that interview (spec D11). The
// new-interview form fills in the role and the lead's job description. Shown
// only while AI interviews are open to candidates.

export function PrepareForInterview({ leadId, className }: { leadId: string; className?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let live = true;
    aiInterviewsOpenAction()
      .then((v) => live && setOpen(v))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  if (!open) return null;
  return (
    <div className={cn("flex flex-col gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 sm:flex-row sm:items-center", className)}>
      <p className="flex-1 text-sm">
        <span className="font-medium">Interview coming up?</span>{" "}
        <span className="text-muted-foreground">Practice for this one with an AI mock interview.</span>
      </p>
      <Link href={`/mock-interviews/ai/new?lead=${encodeURIComponent(leadId)}`} className={cn(buttonVariants(), "shrink-0")}>
        <MessagesSquare className="size-4" aria-hidden />
        Prepare for this interview
      </Link>
    </div>
  );
}
