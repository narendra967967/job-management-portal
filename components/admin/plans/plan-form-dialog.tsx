"use client";

// Add / edit a subscription plan (admin). UI-first: onSave receives the values +
// the chosen status (draft vs active). Recommended is NOT set here — it's toggled
// from the card. Code is an auto slug of the name (locked once the plan exists).

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
import { RichText } from "@/components/admin/ui/rich-text";
import {
  ACCENTS,
  ACCENT_KEYS,
  type Plan,
  type PlanStatus,
  type Currency,
  type AccentKey,
} from "@/lib/admin/mock-plans";
import { cn } from "@/lib/utils";

export interface PlanFormValues {
  name: string;
  code: string;
  description: string;
  accent: AccentKey;
  isFree: boolean;
  freeDurationDays: number;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: Currency;
  limitResumes: number | null;
  allowCustomPrompts: boolean;
  features: string[];
  status: PlanStatus;
}

const selectCls =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const slugify = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border p-4">
      <h4 className="mb-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{title}</h4>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

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
  const [description, setDescription] = useState("");
  const [accent, setAccent] = useState<AccentKey>("indigo");
  const [isFree, setIsFree] = useState(false);
  const [freeDurationDays, setFreeDurationDays] = useState("14");
  const [monthlyPrice, setMonthlyPrice] = useState("0");
  const [yearlyPrice, setYearlyPrice] = useState("0");
  const [currency, setCurrency] = useState<Currency>("INR");
  const [resumesUnlimited, setResumesUnlimited] = useState(false);
  const [limitResumes, setLimitResumes] = useState("3");
  const [allowCustomPrompts, setAllowCustomPrompts] = useState(false);
  const [features, setFeatures] = useState<string[]>([""]);
  const [error, setError] = useState("");

  // Code is auto: tracks the name on add, frozen to the plan's code on edit.
  const code = editing ? (plan?.code ?? "") : slugify(name);

  useEffect(() => {
    if (!open) return;
    setName(plan?.name ?? "");
    setDescription(plan?.description ?? "");
    setAccent(plan?.accent ?? "indigo");
    setIsFree(plan?.isFree ?? false);
    setFreeDurationDays(String(plan?.freeDurationDays ?? 14));
    setMonthlyPrice(String(plan?.monthlyPrice ?? 0));
    setYearlyPrice(String(plan?.yearlyPrice ?? 0));
    setCurrency(plan?.currency ?? "INR");
    setResumesUnlimited(plan ? plan.limitResumes === null : false);
    setLimitResumes(String(plan?.limitResumes ?? 3));
    setAllowCustomPrompts(plan?.allowCustomPrompts ?? false);
    setFeatures(plan && plan.features.length ? [...plan.features] : [""]);
    setError("");
  }, [open, plan]);

  function setFeature(i: number, v: string) {
    setFeatures((f) => f.map((x, idx) => (idx === i ? v : x)));
  }
  function addFeature() {
    setFeatures((f) => [...f, ""]);
  }
  function removeFeature(i: number) {
    setFeatures((f) => (f.length === 1 ? [""] : f.filter((_, idx) => idx !== i)));
  }

  function submit(status: PlanStatus) {
    if (!name.trim()) return setError("Name is required.");
    const monthly = isFree ? 0 : Number(monthlyPrice) || 0;
    const yearly = isFree ? 0 : Number(yearlyPrice) || 0;
    if (!isFree) {
      if (monthly < 0 || yearly < 0) return setError("Prices can't be negative.");
      if (monthly === 0 && yearly === 0)
        return setError("Set a monthly or yearly price (0 disables an interval, but a paid plan needs at least one).");
    }
    onSave({
      name: name.trim(),
      code,
      description,
      accent,
      isFree,
      freeDurationDays: isFree ? Math.max(0, Math.round(Number(freeDurationDays) || 0)) : 0,
      monthlyPrice: Math.round(monthly),
      yearlyPrice: Math.round(yearly),
      currency,
      limitResumes: resumesUnlimited ? null : Math.max(0, Math.round(Number(limitResumes) || 0)),
      allowCustomPrompts,
      features: features.map((f) => f.trim()).filter(Boolean),
      status,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit plan" : "Add plan"}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[68vh] space-y-4 overflow-y-auto pr-1">
          {/* Basics */}
          <Section title="Basics">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pro" />
              </Field>
              <Field label="Code" hint="(auto)">
                <Input value={code} disabled placeholder="auto-generated" className="font-mono" />
              </Field>
            </div>
            <Field label="Description">
              <RichText value={description} onChange={setDescription} placeholder="Describe the plan…" />
            </Field>
          </Section>

          {/* Appearance */}
          <Section title="Header colour">
            <div className="flex flex-wrap gap-2">
              {ACCENT_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setAccent(k)}
                  aria-label={ACCENTS[k].label}
                  title={ACCENTS[k].label}
                  className={cn(
                    "size-8 rounded-full bg-gradient-to-br ring-offset-2 ring-offset-background transition",
                    ACCENTS[k].grad,
                    accent === k ? "ring-2 ring-foreground" : "hover:scale-110",
                  )}
                />
              ))}
            </div>
          </Section>

          {/* Free toggle */}
          <label className="flex items-start gap-2 rounded-xl border border-input bg-muted/30 p-3 text-sm">
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

          {/* Pricing OR free duration */}
          {isFree ? (
            <Section title="Access">
              <Field label="Free access duration (days)" hint="(0 = never expires)">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={freeDurationDays}
                  onChange={(e) => setFreeDurationDays(e.target.value)}
                  className="w-40"
                />
              </Field>
            </Section>
          ) : (
            <Section title="Pricing">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Monthly price">
                  <Input type="number" min={0} step={1} value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value)} />
                </Field>
                <Field label="Yearly price">
                  <Input type="number" min={0} step={1} value={yearlyPrice} onChange={(e) => setYearlyPrice(e.target.value)} />
                </Field>
                <Field label="Currency">
                  <select className={selectCls} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                    <option value="INR">₹ INR</option>
                    <option value="USD">$ USD</option>
                  </select>
                </Field>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Set a price to <span className="font-medium">0</span> to disable that interval. A paid plan needs at least one.
              </p>
            </Section>
          )}

          {/* Limits */}
          <Section title="Limits">
            <Field label="Résumé uploads">
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={limitResumes}
                  onChange={(e) => setLimitResumes(e.target.value)}
                  disabled={resumesUnlimited}
                  className="w-28"
                />
                <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={resumesUnlimited}
                    onChange={(e) => setResumesUnlimited(e.target.checked)}
                    className="size-4 cursor-pointer rounded border-input accent-primary"
                  />
                  Unlimited
                </label>
              </div>
            </Field>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowCustomPrompts}
                onChange={(e) => setAllowCustomPrompts(e.target.checked)}
                className="size-4 cursor-pointer rounded border-input accent-primary"
              />
              Allow custom AI prompts on this plan
            </label>
          </Section>

          {/* Features */}
          <Section title="Features">
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
          </Section>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {isFree ? (
            <Button onClick={() => submit("active")}>{editing ? "Save changes" : "Save plan"}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => submit("inactive")}>Save as draft</Button>
              <Button onClick={() => submit("active")}>Save &amp; activate</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
