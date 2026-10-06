"use client";

// Plans & Pricing (Sales & Revenue) — client grid wired to the real plans table.
// Data comes from the server page; every mutation goes through a Server Action,
// then router.refresh re-reads. Colored card-per-row with activate/deactivate,
// edit, add, delete, and a single-winner "Recommended" toggle.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Check, Users, Star, FileText, Sparkles } from "lucide-react";
import { Card } from "@/components/admin/ui/card";
import { Button } from "@/components/admin/ui/button";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { PlanFormDialog, type PlanFormValues } from "@/components/admin/plans/plan-form-dialog";
import {
  createPlanAction,
  updatePlanAction,
  deletePlanAction,
  setPlanStatusAction,
  setPlanRecommendedAction,
} from "@/actions/admin-plans";
import { ACCENTS, formatMoney, yearlySavingsPct, type Plan } from "@/lib/admin/plans-model";
import { cn } from "@/lib/utils";

export function PlansClient({ initial }: { initial: Plan[] }) {
  const router = useRouter();
  const plans = initial;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
  const [recoTarget, setRecoTarget] = useState<Plan | null>(null);
  const [flash, setFlash] = useState("");
  const [flashErr, setFlashErr] = useState(false);

  const currentReco = plans.find((p) => p.popular) ?? null;

  function say(msg: string, err = false) {
    setFlash(msg);
    setFlashErr(err);
    setTimeout(() => setFlash((m) => (m === msg ? "" : m)), 2800);
  }

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(plan: Plan) {
    setEditing(plan);
    setFormOpen(true);
  }

  // Returned to the dialog so it can stay open + show server errors (e.g. dup code).
  async function savePlan(values: PlanFormValues): Promise<{ ok: boolean; error?: string }> {
    const res = editing ? await updatePlanAction(editing.id, values) : await createPlanAction(values);
    if (res.ok) {
      say(editing ? `Updated “${values.name}”.` : `Added “${values.name}”.`);
      router.refresh();
    }
    return res;
  }

  async function toggleStatus(plan: Plan) {
    const next = plan.status === "active" ? "inactive" : "active";
    const res = await setPlanStatusAction(plan.id, next);
    if (res.ok) {
      say(plan.isFree ? `${plan.name} is now the active free plan.` : `${plan.name} is now ${next}.`);
      router.refresh();
    } else say(res.error, true);
  }

  async function setRecommended(plan: Plan, recommended: boolean) {
    const res = await setPlanRecommendedAction(plan.id, recommended);
    if (res.ok) {
      say(recommended ? `${plan.name} is now the recommended plan.` : `${plan.name} is no longer recommended.`);
      router.refresh();
    } else say(res.error, true);
  }

  // Single-winner recommended: unset directly; set needs a confirm if another holds it.
  function requestRecommend(plan: Plan) {
    if (plan.popular) {
      void setRecommended(plan, false);
      return;
    }
    if (currentReco && currentReco.id !== plan.id) {
      setRecoTarget(plan);
      return;
    }
    void setRecommended(plan, true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const res = await deletePlanAction(deleteTarget.id);
    if (res.ok) {
      say(`Deleted “${deleteTarget.name}”.`);
      router.refresh();
    } else say(res.error, true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {flash ? (
          <span className={cn("text-sm", flashErr ? "text-destructive" : "text-status-applied-foreground")}>{flash}</span>
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
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            onEdit={() => openEdit(plan)}
            onToggle={() => toggleStatus(plan)}
            onDelete={() => setDeleteTarget(plan)}
            onRecommend={() => requestRecommend(plan)}
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

      <ConfirmDialog
        open={recoTarget !== null}
        onOpenChange={(o) => !o && setRecoTarget(null)}
        title="Change the recommended plan?"
        description={`“${currentReco?.name}” is currently recommended. Marking “${recoTarget?.name}” will remove it from “${currentReco?.name}”.`}
        confirmLabel="Make recommended"
        onConfirm={() => recoTarget && setRecommended(recoTarget, true)}
      />
    </div>
  );
}

function PriceBlock({ plan }: { plan: Plan }) {
  if (plan.isFree) return <span className="text-2xl font-bold">Free</span>;
  const m = plan.monthlyPrice > 0;
  const y = plan.yearlyPrice > 0;
  if (!m && !y) return <span className="text-sm text-white/80">No price set</span>;
  const savings = yearlySavingsPct(plan);
  return (
    <div className="text-right">
      <div className="flex items-baseline justify-end gap-1">
        <span className="text-2xl font-bold tabular-nums">
          {formatMoney(m ? plan.monthlyPrice : plan.yearlyPrice, plan.currency)}
        </span>
        <span className="text-xs text-white/80">/{m ? "mo" : "yr"}</span>
      </div>
      <div className="text-[11px] text-white/85">
        {m && y ? (
          <>
            {formatMoney(plan.yearlyPrice, plan.currency)} / yr
            {savings !== null && <span className="ml-1 font-semibold">· save {savings}%</span>}
          </>
        ) : m ? (
          "Monthly billing only"
        ) : (
          "Yearly billing only"
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
  onRecommend,
}: {
  plan: Plan;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onRecommend: () => void;
}) {
  const accent = ACCENTS[plan.accent];
  const active = plan.status === "active";
  const usedLock = plan.everSubscribed > 0;
  const freeActiveLock = plan.isFree && active; // the active free plan must stay
  const deleteDisabled = freeActiveLock || usedLock;
  const deleteTitle = freeActiveLock
    ? "Can't delete the active free plan. Activate another free plan first."
    : usedLock
      ? `Can't delete — ${plan.everSubscribed} user${plan.everSubscribed === 1 ? " has" : "s have"} used this plan. Deactivate instead.`
      : "Delete plan";

  return (
    <Card className={cn("flex h-full flex-col overflow-hidden p-0", plan.popular && `ring-2 ${accent.ring}`)}>
      {/* Colored header */}
      <div className={cn("bg-gradient-to-br px-5 py-4 text-white", active ? accent.grad : "from-slate-500 to-slate-600")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              {plan.isFree && <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium">Default</span>}
              {plan.popular && <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-semibold">★ Recommended</span>}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-white/80">
              <span className="rounded-full bg-white/15 px-1.5 py-0.5">{active ? "Active" : "Draft"}</span>
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
        {plan.description && (
          // Rich-text HTML from the admin's own editor (admin-authored, not user input).
          <div
            className="text-sm text-muted-foreground [&_b]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: plan.description }}
          />
        )}

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

        {/* Limits */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="size-3.5" aria-hidden />
            Résumés: <span className="font-medium text-foreground">{plan.limitResumes === null ? "Unlimited" : plan.limitResumes}</span>
          </span>
          <span className="flex items-center gap-1">
            <Sparkles className="size-3.5" aria-hidden />
            Custom AI prompts: <span className="font-medium text-foreground">{plan.allowCustomPrompts ? "Yes" : "No"}</span>
          </span>
          {plan.isFree && (
            <span>
              Access: <span className="font-medium text-foreground">{plan.freeDurationDays > 0 ? `${plan.freeDurationDays} days` : "No expiry"}</span>
            </span>
          )}
        </div>

        <div className="mt-auto flex items-center gap-1.5 pt-1 text-sm text-muted-foreground">
          <Users className="size-4" aria-hidden />
          <span className="font-semibold tabular-nums text-foreground">{plan.subscribers}</span>
          subscriber{plan.subscribers === 1 ? "" : "s"}
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/30 px-5 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onRecommend}
          className={cn(plan.popular ? "text-amber-500" : "text-muted-foreground")}
          title={plan.popular ? "Remove recommended" : "Mark as recommended"}
        >
          <Star className={cn("size-4", plan.popular && "fill-current")} />
          {plan.popular ? "Recommended" : "Recommend"}
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil /> Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggle}
            disabled={freeActiveLock}
            title={freeActiveLock ? "A free plan must stay active — activate another free plan to switch." : undefined}
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
