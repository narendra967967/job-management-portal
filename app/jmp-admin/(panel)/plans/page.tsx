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
import { Badge } from "@/components/admin/ui/badge";
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

      <div className="space-y-4">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            onEdit={() => openEdit(plan)}
            onToggle={() => toggleStatus(plan)}
            onDelete={() => setDeleteTarget(plan)}
          />
        ))}
        {plans.length === 0 && (
          <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
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

function PriceBlock({ plan }: { plan: Plan }) {
  if (plan.isFree) {
    return <span className="text-xl font-semibold">Free</span>;
  }
  if (plan.monthlyPrice === 0 && plan.yearlyPrice === 0) {
    return <span className="text-sm text-muted-foreground">No price set</span>;
  }
  const savings = yearlySavingsPct(plan);
  return (
    <div className="sm:text-right">
      <div className="flex items-baseline gap-1 sm:justify-end">
        <span className="text-2xl font-semibold tabular-nums">
          {formatMoney(plan.monthlyPrice, plan.currency)}
        </span>
        <span className="text-sm text-muted-foreground">/mo</span>
      </div>
      <div className="text-xs text-muted-foreground">
        {formatMoney(plan.yearlyPrice, plan.currency)} / yr
        {savings !== null && (
          <span className="ml-1 font-medium text-status-applied-foreground">· save {savings}%</span>
        )}
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  onEdit,
  onToggle,
  onDelete,
}: {
  plan: Plan;
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
    <Card className={cn("overflow-hidden p-0", plan.popular && "ring-1 ring-primary/40")}>
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">{plan.name}</h3>
          <Badge variant={active ? "success" : "neutral"}>{active ? "Active" : "Inactive"}</Badge>
          {plan.isFree && <Badge variant="neutral">Default</Badge>}
          {plan.popular && <Badge variant="warning">Recommended</Badge>}
          <code className="text-[11px] text-muted-foreground">{plan.code}</code>
        </div>
        <PriceBlock plan={plan} />
      </div>

      {/* Body */}
      <div className="space-y-3 px-5 py-4">
        {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}
        {plan.features.length > 0 && (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {plan.features.map((f, i) => (
              <li key={i} className="flex items-center gap-1.5 text-sm">
                <Check className="size-3.5 shrink-0 text-status-applied-foreground" aria-hidden />
                <span className="min-w-0 truncate">{f}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="size-4" aria-hidden />
          <span className="font-semibold tabular-nums text-foreground">{plan.subscribers}</span>
          subscriber{plan.subscribers === 1 ? "" : "s"}
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-5 py-3">
        <span className="text-[11px] text-muted-foreground">
          {plan.isFree
            ? "Default plan — assigned on onboarding."
            : usedLock
              ? `Used by ${plan.everSubscribed} user${plan.everSubscribed === 1 ? "" : "s"} over time.`
              : ""}
        </span>
        <div className="flex flex-wrap gap-2">
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
      </div>
    </Card>
  );
}
