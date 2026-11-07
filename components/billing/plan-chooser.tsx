"use client";

// Loads what the plan picker needs and ties it to the checkout dialog. Used by
// Settings → Plan (variant "settings": renew + plans above) and the Upgrade Plan
// page (variant "upgrade": every paid plan).

import { useCallback, useEffect, useState } from "react";
import { PlanOffers, visibleOffers } from "@/components/billing/plan-offers";
import { CheckoutDialog } from "@/components/billing/checkout-dialog";
import { getPlanOptionsAction, type PlanOptions } from "@/actions/plan";
import type { BillingPeriod, OfferPlan } from "@/lib/billing-model";
import { useMockPayments } from "@/lib/payments-mock";

export function PlanChooser({
  variant,
  onChanged,
  empty,
}: {
  variant: "settings" | "upgrade";
  /** After a successful payment (reload plan details, unlock the app). */
  onChanged?: () => void;
  /** Shown when there's nothing to buy. */
  empty?: React.ReactNode;
}) {
  const [options, setOptions] = useState<PlanOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [chosen, setChosen] = useState<{ plan: OfferPlan; period: BillingPeriod } | null>(null);
  const [open, setOpen] = useState(false);
  const online = useMockPayments().razorpay.enabled; // PHASE 1: real gateway state in Phase 3

  const load = useCallback(() => {
    getPlanOptionsAction()
      .then(setOptions)
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  if (loading) return <p className="py-6 text-center text-sm text-muted-foreground">Loading plans…</p>;
  if (!options) return null;
  if (visibleOffers(options.offers, options.current, variant).length === 0) return <>{empty ?? null}</>;

  return (
    <>
      <PlanOffers
        offers={options.offers}
        current={options.current}
        variant={variant}
        onChoose={(plan, period) => {
          setChosen({ plan, period });
          setOpen(true);
        }}
      />
      <CheckoutDialog
        open={open}
        onOpenChange={setOpen}
        plan={chosen?.plan ?? null}
        period={chosen?.period ?? "monthly"}
        current={options.current}
        tax={options.tax}
        online={online}
        onPaid={() => {
          setOpen(false);
          load();
          onChanged?.();
        }}
      />
    </>
  );
}
