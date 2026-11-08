"use client";

// Upgrade Plan page body. In limited mode it explains the plan has ended and
// that nothing is lost; otherwise it's a plain plan comparison.

import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { PlanChooser } from "@/components/billing/plan-chooser";
import { useLimitedMode } from "@/lib/access-mode";

export function UpgradeClient() {
  const limited = useLimitedMode();
  const router = useRouter();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-lg font-semibold tracking-tight">{limited ? "Your plan has ended" : "Upgrade your plan"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {limited
          ? "Pick a plan to unlock everything again."
          : "Compare plans and pick the one that fits your job search."}
      </p>
      {limited && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-status-applied/50 px-3 py-2.5 text-xs text-status-applied-foreground">
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          Your leads, contacts and settings are safe. They&rsquo;re all waiting for you.
        </p>
      )}
      <div className="mt-5">
        <PlanChooser
          variant="upgrade"
          // The layout re-reads the plan (unlocks limited mode), then Leads.
          onChanged={() => {
            router.refresh();
            router.push("/leads");
          }}
          empty={
            <p className="rounded-xl bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
              No plans are available to buy right now. Contact support and we&rsquo;ll sort it out.
            </p>
          }
        />
      </div>
    </div>
  );
}
