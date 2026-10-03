"use client";

// Plans & Pricing (Sales & Revenue). UI-first with local mock state; billing is
// wired later. Card-per-row list (header / body / footer) with activate/
// deactivate, edit, add, and a delete blocked once any user has ever been on the
// plan. "Free" is a flagged default plan — can't be deleted or deactivated, and
// only one plan can be free.

import { useState } from "react";
import { Plus, Pencil, Trash2, Check, Users } from "lucide-react";
import { Card } from "@/components/admin/ui/card";
import { Button } from "@/components/admin/ui/button";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { PlanFormDialog, type PlanFormValues } from "@/components/admin/plans/plan-form-dialog";
import {
  MOCK_PLANS,
  formatMoney,
  yearlySavingsPct,
  type Plan,
} from "@/lib/admin/mock-plans";
import { cn } from "@/lib/utils";

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>(MOCK_PLANS);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
  const [flash, setFlash] = useState("");

  function say(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash((m) => (m === msg ? "" : m)), 2500);
  }

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(plan: Plan) {
    setEditing(plan);
    setFormOpen(true);
  }

  function savePlan(values: PlanFormValues) {
    setPlans((ps) => {
      // Only one plan can be the free/default plan.
      const cleared = values.isFree
        ? ps.map((p) => (editing && p.id === editing.id ? p : { ...p, isFree: false }))
        : ps;
      if (editing) {
        return cleared.map((p) => (p.id === editing.id ? { ...p, ...values } : p));
      }
      return [
        ...cleared,
        { ...values, id: `plan_${Date.now()}`, subscribers: 0, everSubscribed: 0 },
      ];
    });
    say(editing ? `Updated “${values.name}”.` : `Added “${values.name}”.`);
  }

  function toggleStatus(plan: Plan) {
    const next = plan.status === "active" ? "inactive" : "active";
    setPlans((ps) => ps.map((p) => (p.id === plan.id ? { ...p, status: next } : p)));
    say(`${plan.name} is now ${next === "active" ? "active" : "inactive"}.`);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setPlans((ps) => ps.filter((p) => p.id !== deleteTarget.id));
    say(`Deleted “${deleteTarget.name}”.`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {flash ? (
          <span className="text-sm text-status-applied-foreground">{flash}</span>
        ) : (
          <span className="text-sm text-muted-foreground">
            {plans.length} plan{plans.length === 1 ? "" : "s"}
          </span>
        )}
        <Button onClick={openAdd}>
          <Plus /> Add plan
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {plans.map((plan, i) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            accent={ACCENTS[i % ACCENTS.length]}
            onEdit={() => openEdit(plan)}
            onToggle={() => toggleStatus(plan)}
            onDelete={() => setDeleteTarget(plan)}
          />
        ))}
        {plans.length === 0 && (
          <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground lg:col-span-2">
            No plans yet.
          </div>
        )}
      </div>

      <PlanFormDialog open={formOpen} onOpenChange={setFormOpen} plan={editing} onSave={savePlan} />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete “${deleteTarget?.name}”?`}
        description="This permanently removes the plan. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  );
}

// Per-card accent (colored gradient header + feature-check + ring). Cycled by
// index; classes are literal so Tailwind picks them up. White text on the -600→
// -700 gradients stays readable.
type Accent = { grad: string; ring: string; check: string };
const ACCENTS: Accent[] = [
  { grad: "from-indigo-600 to-indigo-700", ring: "ring-indigo-400", check: "text-indigo-500" },
  { grad: "from-emerald-600 to-emerald-700", ring: "ring-emerald-400", check: "text-emerald-500" },
  { grad: "from-violet-600 to-violet-700", ring: "ring-violet-400", check: "text-violet-500" },
  { grad: "from-rose-600 to-rose-700", ring: "ring-rose-400", check: "text-rose-500" },
  { grad: "from-teal-600 to-teal-700", ring: "ring-teal-400", check: "text-teal-500" },
  { grad: "from-fuchsia-600 to-fuchsia-700", ring: "ring-fuchsia-400", check: "text-fuchsia-500" },
];

function PriceBlock({ plan }: { plan: Plan }) {
  if (plan.isFree) return <span className="text-2xl font-bold">Free</span>;
  if (plan.monthlyPrice === 0 && plan.yearlyPrice === 0) {
    return <span className="text-sm text-white/80">No price set</span>;
  }
  const savings = yearlySavingsPct(plan);
  return (
    <div className="text-right">
      <div className="flex items-baseline justify-end gap-1">
        <span className="text-2xl font-bold tabular-nums">{formatMoney(plan.monthlyPrice, plan.currency)}</span>
        <span className="text-xs text-white/80">/mo</span>
      </div>
      <div className="text-[11px] text-white/85">
        {formatMoney(plan.yearlyPrice, plan.currency)} / yr
        {savings !== null && <span className="ml-1 font-semibold">· save {savings}%</span>}
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  accent,
  onEdit,
  onToggle,
  onDelete,
}: {
  plan: Plan;
  accent: Accent;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const active = plan.status === "active";
  const usedLock = plan.everSubscribed > 0; // ever taken → can't delete
  const deleteDisabled = plan.isFree || usedLock;
  const deleteTitle = plan.isFree
    ? "The default (Free) plan can't be deleted."
    : usedLock
      ? `Can't delete — ${plan.everSubscribed} user${plan.everSubscribed === 1 ? " has" : "s have"} used this plan. Deactivate instead.`
      : "Delete plan";

  return (
    <Card
      className={cn(
        "flex h-full flex-col overflow-hidden p-0",
        plan.popular && `ring-2 ${accent.ring}`,
      )}
    >
      {/* Colored header */}
      <div
        className={cn(
          "bg-gradient-to-br px-5 py-4 text-white",
          active ? accent.grad : "from-slate-500 to-slate-600",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              {plan.isFree && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium">Default</span>
              )}
              {plan.popular && (
                <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-semibold">★ Recommended</span>
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-white/80">
              <span className="rounded-full bg-white/15 px-1.5 py-0.5">{active ? "Active" : "Inactive"}</span>
              <code>{plan.code}</code>
            </div>
          </div>
          <div className="shrink-0">
            <PriceBlock plan={plan} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 px-5 py-4">
        {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}
        {plan.features.length > 0 && (
          <ul className="space-y-1.5">
            {plan.features.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <Check className={cn("size-4 shrink-0", accent.check)} aria-hidden />
                <span className="min-w-0">{f}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex items-center gap-1.5 pt-1 text-sm text-muted-foreground">
          <Users className="size-4" aria-hidden />
          <span className="font-semibold tabular-nums text-foreground">{plan.subscribers}</span>
          subscriber{plan.subscribers === 1 ? "" : "s"}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-5 py-3">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil /> Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onToggle}
          disabled={plan.isFree}
          title={plan.isFree ? "The default (Free) plan stays active." : undefined}
        >
          {active ? "Deactivate" : "Activate"}
        </Button>
        <Button
          variant={deleteDisabled ? "outline" : "destructive"}
          size="sm"
          onClick={onDelete}
          disabled={deleteDisabled}
          title={deleteTitle}
        >
          <Trash2 /> Delete
        </Button>
      </div>
    </Card>
  );
}
