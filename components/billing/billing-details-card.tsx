"use client";

// Settings → Profile → Billing details (docs/invoices/spec.md, section 2): the
// details every invoice is issued to, in their own box below the general
// profile. Required before any payment; editing changes future invoices only.
// PHASE 1 (UI first): sample details on screen only; ?sample=empty previews a
// user who hasn't given them. Phase 3 loads and saves the user's own.

import { useEffect, useState } from "react";
import { CircleAlert, MapPin, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { BillingDetailsDialog } from "@/components/billing/billing-details-form";
import { EMPTY_BILLING, SAMPLE_BILLING, billingPlace, isBillingComplete, type BillingDetails } from "@/lib/invoices/billing-details";

export function BillingDetailsSection() {
  const [billing, setBilling] = useState<BillingDetails | null>(SAMPLE_BILLING);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("sample") === "empty") setBilling(null);
  }, []);

  return (
    <>
      <BillingCard billing={billing} onEdit={() => setEditing(true)} />
      <BillingDetailsDialog
        open={editing}
        onOpenChange={setEditing}
        initial={billing ?? EMPTY_BILLING}
        reason={billing ? "edit" : "add"}
        onSave={async (d) => {
          // Phase 3 saves this on the server, with the same checks.
          setBilling(d);
          setEditing(false);
          toast.success("Billing details saved", "Future invoices will use them.");
          return null;
        }}
      />
    </>
  );
}

function BillingCard({ billing, onEdit }: { billing: BillingDetails | null; onEdit: () => void }) {
  const complete = isBillingComplete(billing);
  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="size-4 text-muted-foreground" aria-hidden />
          Billing details
        </h2>
        <Button variant="outline" size="sm" className="h-11 shrink-0 gap-1.5 bg-white/50 sm:h-9" onClick={onEdit}>
          <Pencil className="size-4" aria-hidden />
          {billing ? "Edit" : "Add details"}
        </Button>
      </div>
      {!billing ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>Add your billing details before your first payment. They go on your invoices, and you&apos;re asked only once.</p>
        </div>
      ) : (
        <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Name on invoices</dt>
            <dd className="font-medium">{billing.businessName || billing.fullName}</dd>
            {billing.businessName && <dd className="text-xs text-muted-foreground">Attn: {billing.fullName}</dd>}
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Mobile</dt>
            <dd>+91 {billing.mobile}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Address</dt>
            <dd>{billing.addressLine}</dd>
            <dd>{billingPlace(billing)}, India</dd>
          </div>
          {billing.gstin && (
            <div>
              <dt className="text-xs text-muted-foreground">GSTIN</dt>
              <dd className="font-mono text-[13px]">{billing.gstin}</dd>
            </div>
          )}
          {billing.pan && (
            <div>
              <dt className="text-xs text-muted-foreground">PAN</dt>
              <dd className="font-mono text-[13px]">{billing.pan}</dd>
            </div>
          )}
          {!complete && <dd className="text-xs text-destructive sm:col-span-2">Some details are missing. Edit them before your next payment.</dd>}
        </dl>
      )}
    </section>
  );
}
