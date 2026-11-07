"use client";

// Plan picker for Settings → Plan and the Upgrade Plan page: a monthly/yearly
// switch and one card per plan the user can buy. Settings shows their own plan
// (to renew) and the plans above it; Upgrade Plan shows every paid plan.
// Free plans never appear (the free trial is once only).

import { useMemo, useState } from "react";
import { Check, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { planGradientClass } from "@/lib/plan-accent";
import { planHighlights } from "@/lib/plan-highlights";
import {
  formatPrice,
  periodsFor,
  priceFor,
  type BillingPeriod,
  type CurrentPlanInfo,
  type OfferPlan,
} from "@/lib/billing-model";

/** Comparable monthly value, so yearly-only plans still sort and compare. */
function rank(p: Pick<OfferPlan, "monthlyPrice" | "yearlyPrice">): number {
  return p.monthlyPrice > 0 ? p.monthlyPrice : p.yearlyPrice / 12;
}

/** Plans to show: everything (upgrade), or the user's own paid plan plus the ones above it (settings). */
export function visibleOffers(
  offers: OfferPlan[],
  current: CurrentPlanInfo,
  variant: "settings" | "upgrade",
): OfferPlan[] {
  if (variant === "upgrade") return offers;
  const curRank = rank(current);
  return offers.filter((o) => (o.id === current.planId ? !current.isFree : rank(o) > curRank));
}

export function PlanOffers({
  offers,
  current,
  variant,
  onChoose,
}: {
  offers: OfferPlan[];
  current: CurrentPlanInfo;
  variant: "settings" | "upgrade";
  onChoose: (plan: OfferPlan, period: BillingPeriod) => void;
}) {
  const shown = useMemo(() => visibleOffers(offers, current, variant), [offers, current, variant]);
  const anyMonthly = shown.some((p) => p.monthlyPrice > 0);
  const [period, setPeriod] = useState<BillingPeriod>(anyMonthly ? "monthly" : "yearly");

  // Best yearly saving across the shown plans, for the switch label.
  const bestSaving = Math.max(
    0,
    ...shown.map((p) =>
      p.monthlyPrice > 0 && p.yearlyPrice > 0 ? Math.round((1 - p.yearlyPrice / (p.monthlyPrice * 12)) * 100) : 0,
    ),
  );

  if (shown.length === 0) return null;

  return (
    <div>
      <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-xl bg-muted/70 p-1">
        {(["monthly", "yearly"] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={period === p}
            onClick={() => setPeriod(p)}
            className={cn(
              "min-h-10 rounded-lg px-4 text-sm font-medium transition-colors",
              period === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p === "monthly" ? "Monthly" : "Yearly"}
            {p === "yearly" && bestSaving > 0 && (
              <span className="ml-1.5 rounded-full bg-status-applied px-1.5 py-0.5 text-[10px] font-semibold text-status-applied-foreground">
                Save up to {bestSaving}%
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((plan, i) => {
          const isCurrent = plan.id === current.planId;
          const offered = periodsFor(plan).includes(period);
          const price = priceFor(plan, period);
          const { intro, items } = planHighlights(plan, i > 0 ? shown[i - 1] : undefined);
          const cta = isCurrent ? `Renew ${plan.name}` : variant === "settings" ? `Upgrade to ${plan.name}` : `Choose ${plan.name}`;
          return (
            <article
              key={plan.id}
              className={cn(
                "flex flex-col overflow-hidden rounded-2xl border bg-card",
                plan.popular && !isCurrent && "ring-2 ring-primary/40",
              )}
            >
              <div className={cn("bg-gradient-to-br p-4 text-white", planGradientClass(plan.accent))}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 text-base font-semibold">
                    <Crown className="size-4 shrink-0" aria-hidden />
                    {plan.name}
                  </h3>
                  {isCurrent ? (
                    <span className="rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-medium">Your plan</span>
                  ) : plan.popular ? (
                    <span className="rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-medium">Most popular</span>
                  ) : null}
                </div>
                <p className="mt-2 text-2xl font-bold">
                  {offered ? formatPrice(price, plan.currency) : "–"}
                  {offered && (
                    <span className="ml-1 text-xs font-normal opacity-85">/{period === "monthly" ? "month" : "year"}</span>
                  )}
                </p>
                {!offered && (
                  <p className="text-xs opacity-90">
                    Available {period === "monthly" ? "yearly" : "monthly"} only
                  </p>
                )}
              </div>

              <div className="flex flex-1 flex-col p-4">
                {intro && <p className="text-xs font-medium text-muted-foreground">{intro}</p>}
                <ul className="mt-1.5 flex-1 space-y-1.5">
                  {items.map((it) => (
                    <li key={it} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      <span className="min-w-0">{it}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-4 w-full"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={!offered}
                  onClick={() => onChoose(plan, period)}
                >
                  {cta}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
