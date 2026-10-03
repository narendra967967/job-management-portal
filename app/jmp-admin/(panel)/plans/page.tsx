"use client";

// Plans & Pricing (Sales & Revenue). UI-first with local mock state; billing is
// wired later. Card-per-row list with activate/deactivate, edit, add, and a
// delete that's blocked once any user has ever been on the plan.

import { useState } from "react";
import { Plus, Pencil, Trash2, Check, Users } from "lucide-react";
import { Card } from "@/components/admin/ui/card";
import { Button } from "@/components/admin/ui/button";
import { Badge } from "@/components/admin/ui/badge";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { PlanFormDialog, type PlanFormValues } from "@/components/admin/plans/plan-form-dialog";
import {
  MOCK_PLANS,
  CYCLE_LABELS,
  formatPrice,
  type Plan,
} from "@/lib/admin/mock-plans";

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
    if (editing) {
      setPlans((ps) => ps.map((p) => (p.id === editing.id ? { ...p, ...values } : p)));
      say(`Updated “${values.name}”.`);
    } else {
      setPlans((ps) => [
        ...ps,
        { ...values, id: `plan_${Date.now()}`, subscribers: 0, everSubscribed: 0 },
      ]);
      say(`Added “${values.name}”.`);
    }
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

      <PlanFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        plan={editing}
        onSave={savePlan}
      />

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
  const locked = plan.everSubscribed > 0; // ever taken → can't delete, only deactivate
  const active = plan.status === "active";

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        {/* Details */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{plan.name}</h3>
            <Badge variant={active ? "success" : "neutral"}>{active ? "Active" : "Inactive"}</Badge>
            {plan.popular && <Badge variant="warning">Recommended</Badge>}
            <code className="text-[11px] text-muted-foreground">{plan.code}</code>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tabular-nums">{formatPrice(plan)}</span>
            {plan.price > 0 && (
              <span className="text-sm text-muted-foreground">/ {CYCLE_LABELS[plan.cycle]}</span>
            )}
            {plan.trialDays > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">· {plan.trialDays}-day free trial</span>
            )}
          </div>

          {plan.description && (
            <p className="text-sm text-muted-foreground">{plan.description}</p>
          )}

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
        </div>

        {/* Subscribers + actions */}
        <div className="flex shrink-0 flex-col gap-4 md:w-52 md:border-l md:border-border md:pl-5">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" aria-hidden />
            <span className="text-sm">
              <span className="font-semibold tabular-nums">{plan.subscribers}</span>
              <span className="text-muted-foreground"> subscriber{plan.subscribers === 1 ? "" : "s"}</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={onToggle}>
              {active ? "Deactivate" : "Activate"}
            </Button>
            <Button
              variant={locked ? "outline" : "destructive"}
              size="sm"
              onClick={onDelete}
              disabled={locked}
              title={
                locked
                  ? `Can't delete — ${plan.everSubscribed} user${plan.everSubscribed === 1 ? " has" : "s have"} used this plan. Deactivate instead.`
                  : "Delete plan"
              }
            >
              <Trash2 /> Delete
            </Button>
          </div>

          {locked && (
            <p className="text-[11px] text-muted-foreground">
              Used by {plan.everSubscribed} user{plan.everSubscribed === 1 ? "" : "s"} over time — delete is locked.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
