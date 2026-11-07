"use client";

// PHASE 1 ONLY: lets reviewers step through the payment states on sample data.
// Removed in Phase 3.

import { cn } from "@/lib/utils";
import { updateMockGateway, updateMockPayments, useMockPayments, type PreviewOutcome } from "@/lib/payments-mock";

export function PaymentsPreviewBar() {
  const m = useMockPayments();
  const chip = (on: boolean) =>
    cn(
      "min-h-9 rounded-md border px-2.5 py-1 font-medium",
      on ? "border-amber-600 bg-amber-200/70 dark:bg-amber-800/60" : "border-amber-300 bg-white/60 dark:bg-transparent",
    );
  return (
    <div className="mb-4 rounded-lg border border-dashed border-amber-400/60 bg-amber-50 p-2.5 text-[11px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      <p className="font-medium">Preview with sample data</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span>Online payment:</span>
        <button type="button" className={chip(m.razorpay.enabled)} onClick={() => updateMockGateway({ enabled: true })}>
          On
        </button>
        <button type="button" className={chip(!m.razorpay.enabled)} onClick={() => updateMockGateway({ enabled: false })}>
          Off
        </button>
        <span className="ml-2">Plan expired:</span>
        <button type="button" className={chip(m.previewLimited)} onClick={() => updateMockPayments({ previewLimited: true })}>
          Yes
        </button>
        <button type="button" className={chip(!m.previewLimited)} onClick={() => updateMockPayments({ previewLimited: false })}>
          No
        </button>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span>Test payment result:</span>
        {(["paid", "cancelled", "failed"] as PreviewOutcome[]).map((o) => (
          <button key={o} type="button" className={chip(m.previewOutcome === o)} onClick={() => updateMockPayments({ previewOutcome: o })}>
            {o === "paid" ? "Paid" : o === "cancelled" ? "Cancelled" : "Failed"}
          </button>
        ))}
      </div>
    </div>
  );
}
