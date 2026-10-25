"use client";

// Public pricing: Monthly/Yearly switch (opens on Yearly), one glass card per
// plan and a feature comparison. Card bullets and the table both come from each
// plan's limits and switches (lib/plan-highlights.ts), never hand-typed text, so
// the page always matches what the app enforces (lib/entitlements.ts).
// Payments aren't built yet: signed-out visitors start the free trial; signed-in
// users manage their plan from Settings → Plan.

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";
import { ACCENTS, formatMoney } from "@/lib/admin/plans-model";
import type { PublicPlan } from "@/lib/pricing";
import { planHighlights } from "@/lib/plan-highlights";
import { cn } from "@/lib/utils";

type Interval = "monthly" | "yearly";
export type PricingCta = "signup" | "login" | "manage";

function savingsPct(p: PublicPlan): number | null {
  if (p.monthlyPrice <= 0 || p.yearlyPrice <= 0) return null;
  const pct = Math.round((1 - p.yearlyPrice / (p.monthlyPrice * 12)) * 100);
  return pct > 0 ? pct : null;
}

/** The interval a paid card shows: the chosen one, or the only one it offers. */
function shownInterval(p: PublicPlan, want: Interval): Interval {
  if (want === "yearly" && p.yearlyPrice > 0) return "yearly";
  if (want === "monthly" && p.monthlyPrice > 0) return "monthly";
  return p.yearlyPrice > 0 ? "yearly" : "monthly";
}

const limit = (n: number | null, unit = "") => (n === null ? "Unlimited" : `${n.toLocaleString("en-IN")}${unit}`);

const ROWS: { label: string; value: (p: PublicPlan) => string | boolean }[] = [
  { label: "Active leads", value: (p) => limit(p.limitActiveLeads) },
  { label: "Résumés", value: (p) => limit(p.limitResumes) },
  { label: "Add with AI", value: (p) => limit(p.limitAiAddMonthly, "/month") },
  { label: "AI outreach drafts", value: (p) => p.allowAiDrafts },
  { label: "AI reading of alerts from more job sites", value: (p) => p.allowAiEmailReading },
  { label: "Personal notes", value: (p) => p.allowNotes },
  { label: "Salary insight", value: (p) => p.allowSalaryInsight },
  { label: "Résumé ATS check", value: (p) => p.allowAtsCheck },
  { label: "Custom AI prompts", value: (p) => p.allowCustomPrompts },
  { label: "Priority support", value: (p) => p.prioritySupport },
];

export function PricingPlans({
  plans,
  cta,
  trial,
  currentPlanId,
}: {
  plans: PublicPlan[];
  cta: PricingCta;
  trial: boolean;
  currentPlanId: string | null;
}) {
  const [interval, setBilling] = useState<Interval>("yearly");
  const hasBoth = plans.some((p) => !p.isFree && p.monthlyPrice > 0 && p.yearlyPrice > 0);
  const bestSaving = Math.max(0, ...plans.map((p) => savingsPct(p) ?? 0));
  // Only show rows where the plans actually differ.
  const rows = ROWS.filter((r) => new Set(plans.map((p) => String(r.value(p)))).size > 1);

  return (
    <>
      {hasBoth && (
        <div className="mt-10 flex justify-center">
          <div role="radiogroup" aria-label="Billing period" className="glass-subtle inline-flex rounded-full p-1">
            {(["monthly", "yearly"] as const).map((iv) => (
              <button
                key={iv}
                type="button"
                role="radio"
                aria-checked={interval === iv}
                onClick={() => setBilling(iv)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-medium transition-colors",
                  interval === iv ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {iv === "monthly" ? "Monthly" : "Yearly"}
                {iv === "yearly" && bestSaving > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      interval === "yearly" ? "bg-white/20" : "bg-emerald-500/15 text-emerald-700",
                    )}
                  >
                    Save up to {bestSaving}%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Flex-wrap (not grid) so an odd last card centres on tablets. */}
      <div className={cn("mx-auto mt-10 flex flex-wrap justify-center gap-5", plans.length >= 3 ? "max-w-6xl" : "max-w-4xl")}>
        {plans.map((p, i) => (
          <PlanCard
            key={p.id}
            plan={p}
            prev={plans[i - 1]}
            interval={interval}
            cta={cta}
            trial={trial}
            current={p.id === currentPlanId}
            threeUp={plans.length >= 3}
          />
        ))}
      </div>

      {rows.length > 0 && plans.length > 1 && (
        <div className="mx-auto mt-20 max-w-4xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">Compare plans</h2>
          <div className="glass mt-8 overflow-hidden rounded-2xl">
            <table className="w-full table-fixed text-left text-sm">
              <caption className="sr-only">Features and limits by plan</caption>
              <thead>
                <tr className="border-b border-white/70">
                  <th scope="col" className="w-[40%] px-3 py-3 font-medium text-muted-foreground sm:px-5">Feature</th>
                  {plans.map((p) => (
                    <th key={p.id} scope="col" className="px-2 py-3 text-center font-semibold sm:px-3">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/60">
                {rows.map((r) => (
                  <tr key={r.label}>
                    <th scope="row" className="px-3 py-3 font-normal sm:px-5">{r.label}</th>
                    {plans.map((p) => {
                      const v = r.value(p);
                      return (
                        <td key={p.id} className="px-2 py-3 text-center text-xs sm:px-3 sm:text-sm">
                          {v === true ? (
                            <Check className={cn("mx-auto size-4", ACCENTS[p.accent].check)} aria-label="Included" />
                          ) : v === false ? (
                            <Minus className="mx-auto size-4 text-muted-foreground/60" aria-label="Not included" />
                          ) : (
                            <span className="font-medium">{v}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function PlanCard({
  plan: p,
  prev,
  interval,
  cta,
  trial,
  current,
  threeUp,
}: {
  plan: PublicPlan;
  /** The next cheaper plan, for "Everything in …, plus:". */
  prev?: PublicPlan;
  interval: Interval;
  cta: PricingCta;
  trial: boolean;
  current: boolean;
  /** Three or more plans: three cards per row on laptops. */
  threeUp: boolean;
}) {
  const accent = ACCENTS[p.accent];
  const iv = shownInterval(p, interval);
  const saving = savingsPct(p);
  const { intro, items } = planHighlights(p, prev);

  let price: string;
  let per: string;
  let note: string;
  if (p.isFree) {
    price = formatMoney(0, p.currency);
    per = "";
    note = p.freeDurationDays > 0 ? `Free for ${p.freeDurationDays} days, no card needed` : "Free, no card needed";
  } else if (iv === "yearly") {
    price = formatMoney(p.yearlyPrice, p.currency);
    per = "/year";
    note = `${formatMoney(Math.round(p.yearlyPrice / 12), p.currency)}/month, billed yearly${saving ? ` · Save ${saving}%` : ""}`;
  } else {
    price = formatMoney(p.monthlyPrice, p.currency);
    per = "/month";
    note = p.yearlyPrice > 0 ? `Or ${formatMoney(p.yearlyPrice, p.currency)}/year${saving ? `, save ${saving}%` : ""}` : "Billed monthly";
  }

  const href = cta === "manage" ? "/settings?tab=plan" : cta === "signup" ? "/signup" : "/login";
  const label =
    cta === "manage" ? (current ? "Your current plan" : "Manage plan") : cta === "signup" ? (trial ? "Start free trial" : "Get started free") : "Log in";

  return (
    <div
      className={cn(
        "glass relative flex w-full flex-col rounded-3xl p-6 md:w-[calc(50%-0.625rem)]",
        threeUp && "lg:w-[calc(33.333%-0.84rem)]",
        p.popular && `ring-2 ${accent.ring}`,
      )}
    >
      {(p.popular || current) && (
        <span
          className={cn(
            "absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-semibold text-white shadow-sm bg-gradient-to-r",
            current ? "from-emerald-600 to-emerald-700" : accent.grad,
          )}
        >
          {current ? "Your plan" : "Most popular"}
        </span>
      )}

      <h3 className="text-lg font-semibold">{p.name}</h3>
      {p.summary && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{p.summary}</p>}

      <div className="mt-5">
        <p className="flex items-baseline gap-1">
          <span className="text-4xl font-semibold tracking-tight tabular-nums">{price}</span>
          {per && <span className="text-sm text-muted-foreground">{per}</span>}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">{note}</p>
      </div>

      <Link
        href={href}
        className={cn(
          "mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-all active:translate-y-px",
          p.popular
            ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            : "glass-strong hover:bg-white/80",
        )}
      >
        {label} {!current && <ArrowRight className="size-4" aria-hidden />}
      </Link>

      {items.length > 0 && (
        <div className="mt-6 border-t border-white/70 pt-5">
          {intro && <p className="mb-3 text-sm font-medium">{intro}</p>}
          <ul className="space-y-2.5">
            {items.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm">
                <Check className={cn("mt-0.5 size-4 shrink-0", accent.check)} aria-hidden />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
