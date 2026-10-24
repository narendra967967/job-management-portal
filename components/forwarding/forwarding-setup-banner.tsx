"use client";

// Leads page nudge (U7): shown until email forwarding is working, so new users
// find the main way leads get in.

import Link from "next/link";
import { Forward } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { forwardingStage } from "@/lib/email-intake-model";
import { useIntake } from "@/lib/mock-store";
import { cn } from "@/lib/utils";

export function ForwardingSetupBanner() {
  const { forwardingEnabled, forwarding } = useIntake();
  if (!forwardingEnabled) return null;
  const stage = forwardingStage(forwarding);
  if (stage === "working") return null;

  const midway = stage !== "not_started";
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3 sm:flex-row sm:items-center">
      <Forward className="hidden size-5 shrink-0 text-primary sm:block" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {midway ? "Finish setting up email forwarding" : "Bring your job alerts in automatically"}
        </p>
        <p className="text-xs text-muted-foreground">
          {midway
            ? "One more step in Gmail and your job alerts will start arriving here."
            : "Forward your job alerts from Gmail to your private Jobtiva address — a 2-minute, one-time setup."}
        </p>
      </div>
      <Link
        href="/settings?tab=forwarding"
        className={cn(buttonVariants({ size: "sm" }), "min-h-10 shrink-0 justify-center")}
      >
        {midway ? "Continue setup" : "Set up forwarding"}
      </Link>
    </div>
  );
}
