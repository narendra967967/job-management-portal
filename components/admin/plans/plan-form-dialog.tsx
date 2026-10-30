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
} from "@/lib/admin/plans-model";
import { cn } from "@/lib/utils";

export interface PlanFormValues {
  name: string;
  code: string;
  description: string;
  accent: AccentKey;
  isFree: boolean;
  isDefault: boolean;
  freeDurationDays: number;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: Currency;
  limitResumes: number | null;
  allowCustomPrompts: boolean;
  allowNotes: boolean;
  allowSalaryInsight: boolean;
  allowAtsCheck: boolean;
  limitActiveLeads: number | null;
  limitAiAddMonthly: number | null;
  allowAiDrafts: boolean;
  allowAiEmailReading: boolean;
  prioritySupport: boolean;
  features: string[];
  showOnPricing: boolean;
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

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
        {hint && <span className="font-normal"> {hint}</span>}
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
  onSave: (values: PlanFormValues) => Promise<{ ok: boolean; error?: string }>;
}) {
  const editing = !!plan;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accent, setAccent] = useState<AccentKey>("indigo");
  const [isFree, setIsFree] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [freeDurationDays, setFreeDurationDays] = useState("14");
  const [monthlyPrice, setMonthlyPrice] = useState("0");
  const [yearlyPrice, setYearlyPrice] = useState("0");
  const [currency, setCurrency] = useState<Currency>("INR");
  const [resumesUnlimited, setResumesUnlimited] = useState(false);
  const [limitResumes, setLimitResumes] = useState("3");
  const [allowCustomPrompts, setAllowCustomPrompts] = useState(false);
  const [allowNotes, setAllowNotes] = useState(false);
  const [allowSalaryInsight, setAllowSalaryInsight] = useState(false);
  const [allowAtsCheck, setAllowAtsCheck] = useState(false);
  const [leadsUnlimited, setLeadsUnlimited] = useState(true);
  const [limitActiveLeads, setLimitActiveLeads] = useState("50");
  const [aiAddUnlimited, setAiAddUnlimited] = useState(true);
  const [limitAiAddMonthly, setLimitAiAddMonthly] = useState("10");
  const [allowAiDrafts, setAllowAiDrafts] = useState(false);
  const [allowAiEmailReading, setAllowAiEmailReading] = useState(false);
  const [prioritySupport, setPrioritySupport] = useState(false);
  const [features, setFeatures] = useState<string[]>([""]);
  const [showOnPricing, setShowOnPricing] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Code is auto: tracks the name on add, frozen to the plan's code on edit.
  const code = editing ? (plan?.code ?? "") : slugify(name);

  useEffect(() => {
    if (!open) return;
    setName(plan?.name ?? "");
    setDescription(plan?.description ?? "");
    setAccent(plan?.accent ?? "indigo");
    setIsFree(plan?.isFree ?? false);
    setIsDefault(plan?.isDefault ?? false);
    setFreeDurationDays(String(plan?.freeDurationDays ?? 14));
    setMonthlyPrice(String(plan?.monthlyPrice ?? 0));
    setYearlyPrice(String(plan?.yearlyPrice ?? 0));
    setCurrency(plan?.currency ?? "INR");
    setResumesUnlimited(plan ? plan.limitResumes === null : false);
    setLimitResumes(String(plan?.limitResumes ?? 3));
    setAllowCustomPrompts(plan?.allowCustomPrompts ?? false);
    setAllowNotes(plan?.allowNotes ?? false);
    setAllowSalaryInsight(plan?.allowSalaryInsight ?? false);
    setAllowAtsCheck(plan?.allowAtsCheck ?? false);
    setLeadsUnlimited(plan ? plan.limitActiveLeads === null : true);
    setLimitActiveLeads(String(plan?.limitActiveLeads ?? 50));
    setAiAddUnlimited(plan ? plan.limitAiAddMonthly === null : true);
    setLimitAiAddMonthly(String(plan?.limitAiAddMonthly ?? 10));
    setAllowAiDrafts(plan?.allowAiDrafts ?? false);
    setAllowAiEmailReading(plan?.allowAiEmailReading ?? false);
    setPrioritySupport(plan?.prioritySupport ?? false);
    setFeatures(plan && plan.features.length ? [...plan.features] : [""]);
    setShowOnPricing(plan?.showOnPricing ?? true);
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

  async function submit(status: PlanStatus) {
    // Name (required) + a valid auto-code derived from it.
    if (!name.trim()) return setError("Name is required.");
    if (!code) return setError("Name must include at least one letter or number.");

    // Pricing — only for paid plans. 0 disables an interval; at least one required.
    const monthly = isFree ? 0 : Math.round(Number(monthlyPrice));
    const yearly = isFree ? 0 : Math.round(Number(yearlyPrice));
    if (!isFree) {
      if (!Number.isFinite(monthly) || !Number.isFinite(yearly) || monthly < 0 || yearly < 0)
        return setError("Enter valid prices (0 or more).");
      if (monthly === 0 && yearly === 0)
        return setError("Set a monthly or yearly price (0 disables an interval, but a paid plan needs at least one).");
    }

    // Free access duration — only for the free plan (0 = never expires).
    const freeDays = Math.round(Number(freeDurationDays));
    if (isFree && (!Number.isFinite(freeDays) || freeDays < 0))
      return setError("Enter a valid free access duration (0 or more days).");

    // Résumé limit — required unless Unlimited is ticked.
    let resumesLimit: number | null = null;
    if (!resumesUnlimited) {
      const n = Number(limitResumes);
      if (limitResumes.trim() === "" || !Number.isFinite(n) || n < 0)
        return setError("Enter a résumé upload limit, or check Unlimited.");
      resumesLimit = Math.round(n);
    }
    const parseLimit = (unlimited: boolean, raw: string): number | null | "bad" => {
      if (unlimited) return null;
      const n = Number(raw);
      return raw.trim() === "" || !Number.isFinite(n) || n < 0 ? "bad" : Math.round(n);
    };
    const leadsLimit = parseLimit(leadsUnlimited, limitActiveLeads);
    if (leadsLimit === "bad") return setError("Enter an active-leads limit, or check Unlimited.");
    const aiAddLimit = parseLimit(aiAddUnlimited, limitAiAddMonthly);
    if (aiAddLimit === "bad") return setError("Enter a monthly Add with AI limit, or check Unlimited.");

    setError("");
    setBusy(true);
    const res = await onSave({
      name: name.trim(),
      code,
      description,
      accent,
      isFree,
      isDefault: isFree ? isDefault : false,
      freeDurationDays: isFree ? freeDays : 0,
      monthlyPrice: monthly,
      yearlyPrice: yearly,
      currency,
      limitResumes: resumesLimit,
      allowCustomPrompts,
      allowNotes,
      allowSalaryInsight,
      allowAtsCheck,
      limitActiveLeads: leadsLimit,
      limitAiAddMonthly: aiAddLimit,
      allowAiDrafts,
      allowAiEmailReading,
      prioritySupport,
      features: features.map((f) => f.trim()).filter(Boolean),
      showOnPricing,
      status,
    });
    setBusy(false);
    if (res.ok) onOpenChange(false);
    else setError(res.error ?? "Couldn't save the plan.");
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
              <Field label="Name" required>
                {/* Letters, digits and spaces only. */}
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9 ]/g, ""))}
                  placeholder="e.g. Pro"
                />
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
          <Section title="Header color">
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
              onChange={(e) => {
                setIsFree(e.target.checked);
                if (!e.target.checked) setIsDefault(false);
              }}
              className="mt-0.5 size-4 cursor-pointer rounded border-input accent-primary"
            />
            <span>
              This is the <span className="font-medium">Free (default)</span> plan
              <span className="block text-xs text-muted-foreground">
                Assigned on onboarding · no pricing. Multiple free plans are allowed, but exactly one stays active at a time.
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
              <label className="flex items-start gap-2 rounded-lg border border-input bg-muted/20 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="mt-0.5 size-4 cursor-pointer rounded border-input accent-primary"
                />
                <span>
                  Default plan for new sign-ups
                  <span className="block text-xs text-muted-foreground">
                    New users (self sign-up and admin-created) land on this plan. Only one plan can be
                    the default — setting this unsets any other. Registration is disabled when no default
                    plan exists.
                  </span>
                </span>
              </label>
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
            <LimitField
              label="Active leads"
              value={limitActiveLeads}
              onValue={setLimitActiveLeads}
              unlimited={leadsUnlimited}
              onUnlimited={setLeadsUnlimited}
            />
            <LimitField
              label="Add with AI per month"
              value={limitAiAddMonthly}
              onValue={setLimitAiAddMonthly}
              unlimited={aiAddUnlimited}
              onUnlimited={setAiAddUnlimited}
            />
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
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowNotes}
                onChange={(e) => setAllowNotes(e.target.checked)}
                className="size-4 cursor-pointer rounded border-input accent-primary"
              />
              Notes (personal notepad)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowSalaryInsight}
                onChange={(e) => setAllowSalaryInsight(e.target.checked)}
                className="size-4 cursor-pointer rounded border-input accent-primary"
              />
              AI salary insight on jobs
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowAtsCheck}
                onChange={(e) => setAllowAtsCheck(e.target.checked)}
                className="size-4 cursor-pointer rounded border-input accent-primary"
              />
              Résumé ATS score check
            </label>
            <PlanSwitch checked={allowAiDrafts} onChange={setAllowAiDrafts} label="AI outreach drafts" />
            <PlanSwitch checked={allowAiEmailReading} onChange={setAllowAiEmailReading} label="AI reads alerts from sites without a built-in reader" />
            <PlanSwitch checked={prioritySupport} onChange={setPrioritySupport} label="Priority support" />
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

          <Section title="Pricing page">
            <PlanSwitch checked={showOnPricing} onChange={setShowOnPricing} label="Show on the public pricing page (when active)" />
          </Section>

        </div>

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="outline" disabled={busy} onClick={() => submit("inactive")}>
            {isFree ? "Save" : "Save as draft"}
          </Button>
          {!isFree && (
            <Button disabled={busy} onClick={() => submit("active")}>Save &amp; activate</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanSwitch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 cursor-pointer rounded border-input accent-primary"
      />
      {label}
    </label>
  );
}

function LimitField({
  label,
  value,
  onValue,
  unlimited,
  onUnlimited,
}: {
  label: string;
  value: string;
  onValue: (v: string) => void;
  unlimited: boolean;
  onUnlimited: (v: boolean) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        <Input type="number" min={0} step={1} value={value} onChange={(e) => onValue(e.target.value)} disabled={unlimited} className="w-28" />
        <PlanSwitch checked={unlimited} onChange={onUnlimited} label="Unlimited" />
      </div>
    </Field>
  );
}
