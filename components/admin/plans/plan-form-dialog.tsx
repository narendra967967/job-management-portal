"use client";

// Add / edit a subscription plan (admin). UI-first: onSave receives the values;
// persistence + billing wiring come later. Code is locked once the plan exists so
// subscriptions keep mapping to it. "Free" is a flagged default plan with no
// pricing; every paid plan carries a monthly and a yearly price.

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/admin/ui/dialog";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { type Plan, type PlanStatus, type Currency } from "@/lib/admin/mock-plans";

export interface PlanFormValues {
  name: string;
  code: string;
  description: string;
  isFree: boolean;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: Currency;
  features: string[];
  popular: boolean;
  status: PlanStatus;
}

const selectCls =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {label} {hint && <span className="font-normal">{hint}</span>}
      </Label>
      {children}
    </label>
  );
}

const slugify = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function PlanFormDialog({
  open,
  onOpenChange,
  plan,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan | null;
  onSave: (values: PlanFormValues) => void;
}) {
  const editing = !!plan;
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [monthlyPrice, setMonthlyPrice] = useState("0");
  const [yearlyPrice, setYearlyPrice] = useState("0");
  const [currency, setCurrency] = useState<Currency>("INR");
  const [features, setFeatures] = useState<string[]>([""]);
  const [popular, setPopular] = useState(false);
  const [status, setStatus] = useState<PlanStatus>("active");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(plan?.name ?? "");
    setCode(plan?.code ?? "");
    setCodeTouched(!!plan);
    setDescription(plan?.description ?? "");
    setIsFree(plan?.isFree ?? false);
    setMonthlyPrice(String(plan?.monthlyPrice ?? 0));
    setYearlyPrice(String(plan?.yearlyPrice ?? 0));
    setCurrency(plan?.currency ?? "INR");
    setFeatures(plan && plan.features.length ? [...plan.features] : [""]);
    setPopular(plan?.popular ?? false);
    setStatus(plan?.status ?? "active");
    setError("");
  }, [open, plan]);

  // Auto-fill code from name until the admin edits it (add mode only).
  function onName(v: string) {
    setName(v);
    if (!editing && !codeTouched) setCode(slugify(v));
  }

  function setFeature(i: number, v: string) {
    setFeatures((f) => f.map((x, idx) => (idx === i ? v : x)));
  }
  function addFeature() {
    setFeatures((f) => [...f, ""]);
  }
  function removeFeature(i: number) {
    setFeatures((f) => (f.length === 1 ? [""] : f.filter((_, idx) => idx !== i)));
  }

  function save() {
    if (!name.trim()) return setError("Name is required.");
    if (!code.trim()) return setError("Code is required.");
    const monthly = isFree ? 0 : Number(monthlyPrice);
    const yearly = isFree ? 0 : Number(yearlyPrice);
    if (!isFree) {
      if (!Number.isFinite(monthly) || monthly < 0) return setError("Enter a valid monthly price (0 or more).");
      if (!Number.isFinite(yearly) || yearly < 0) return setError("Enter a valid yearly price (0 or more).");
    }
    onSave({
      name: name.trim(),
      code: slugify(code),
      description: description.trim(),
      isFree,
      monthlyPrice: Math.round(monthly),
      yearlyPrice: Math.round(yearly),
      currency,
      features: features.map((f) => f.trim()).filter(Boolean),
      popular,
      status,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit plan" : "Add plan"}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input value={name} onChange={(e) => onName(e.target.value)} placeholder="e.g. Pro" />
            </Field>
            <Field label="Code" hint={editing ? "(locked)" : "(internal id)"}>
              <Input
                value={code}
                onChange={(e) => {
                  setCodeTouched(true);
                  setCode(e.target.value);
                }}
                placeholder="pro"
                disabled={editing}
              />
            </Field>
          </div>

          <Field label="Description">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short line shown on the plan card"
            />
          </Field>

          <label className="flex items-start gap-2 rounded-lg border border-input bg-muted/30 p-3 text-sm">
            <input
              type="checkbox"
              checked={isFree}
              onChange={(e) => setIsFree(e.target.checked)}
              className="mt-0.5 size-4 cursor-pointer rounded border-input accent-primary"
            />
            <span>
              This is the <span className="font-medium">Free (default)</span> plan
              <span className="block text-xs text-muted-foreground">
                Assigned on onboarding · no pricing · can&apos;t be deleted or deactivated. Only one plan can be free.
              </span>
            </span>
          </label>

          {!isFree && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Monthly price">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={monthlyPrice}
                  onChange={(e) => setMonthlyPrice(e.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field label="Yearly price">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={yearlyPrice}
                  onChange={(e) => setYearlyPrice(e.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field label="Currency">
                <select className={selectCls} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                  <option value="INR">₹ INR</option>
                  <option value="USD">$ USD</option>
                </select>
              </Field>
            </div>
          )}

          <Field label="Status">
            <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as PlanStatus)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Features</Label>
            <div className="space-y-2">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={f} onChange={(e) => setFeature(i, e.target.value)} placeholder={`Feature ${i + 1}`} />
                  <Button type="button" variant="outline" size="icon" aria-label="Remove feature" onClick={() => removeFeature(i)}>
                    <X />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addFeature}>
              <Plus /> Add feature
            </Button>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={popular}
              onChange={(e) => setPopular(e.target.checked)}
              className="size-4 cursor-pointer rounded border-input accent-primary"
            />
            Mark as recommended (highlight on the pricing page)
          </label>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>{editing ? "Save changes" : "Add plan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
