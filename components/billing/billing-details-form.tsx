"use client";

// Billing details (docs/invoices/spec.md, section 2): asked before the first
// payment and editable in Settings → Payments. Every invoice keeps a copy of
// what was entered when it was paid, so editing here changes future invoices
// only. The same checks run on the server (phase 3).

import { useEffect, useId, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/ui/info-tip";
import { INDIA_STATES } from "@/lib/india-states";
import { billingErrors, type BillingDetails, type BillingErrors } from "@/lib/invoices/billing-details";
import { tableSelectCls } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";

function Field({
  label,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: (id: string, describedBy: string | undefined) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = [error ? errId : "", hint ? hintId : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
      </label>
      {children(id, describedBy)}
      {error ? (
        <p id={errId} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function BillingDetailsForm({
  initial,
  submitLabel,
  onSave,
  onCancel,
}: {
  initial: BillingDetails;
  submitLabel: string;
  /** Resolves with an error message, or null when saved. */
  onSave: (details: BillingDetails) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const [d, setD] = useState<BillingDetails>(initial);
  const [business, setBusiness] = useState(!!initial.gstin);
  const [errors, setErrors] = useState<BillingErrors>({});
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState("");

  const value = (next: BillingDetails) => (business ? next : { ...next, gstin: "", businessName: "" });
  // After the first attempt, errors follow the typing so they clear as soon as a field is fixed.
  useEffect(() => {
    if (tried) setErrors(billingErrors(value(d)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, business, tried]);

  const set = (k: keyof BillingDetails) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setD({ ...d, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    const v = value(d);
    const errs = billingErrors(v);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setServerError("");
    const res = await onSave({
      ...v,
      fullName: v.fullName.trim(),
      mobile: v.mobile.replace(/\D/g, ""),
      addressLine: v.addressLine.trim(),
      city: v.city.trim(),
      pin: v.pin.trim(),
      gstin: v.gstin.trim().toUpperCase(),
      businessName: v.businessName.trim(),
      pan: v.pan.trim().toUpperCase(),
    }).catch(() => "Couldn't save your details. Try again.");
    setBusy(false);
    if (res) setServerError(res);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" hint="As it should appear on your invoices." error={errors.fullName} className="sm:col-span-2">
          {(id, by) => <Input id={id} aria-describedby={by} aria-invalid={!!errors.fullName} value={d.fullName} onChange={set("fullName")} autoComplete="name" maxLength={100} className="h-11 sm:h-9" />}
        </Field>
        <Field label="Mobile number" hint="10 digits. We use it only about your payments." error={errors.mobile}>
          {(id, by) => (
            <div className="flex">
              <span className="inline-flex items-center rounded-l-lg border border-r-0 border-input bg-muted/50 px-3 text-sm text-muted-foreground">+91</span>
              <Input
                id={id}
                aria-describedby={by}
                aria-invalid={!!errors.mobile}
                value={d.mobile}
                onChange={set("mobile")}
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={11}
                className="h-11 rounded-l-none sm:h-9"
              />
            </div>
          )}
        </Field>
        <Field label="Country" hint="Billing addresses in India only, for now.">
          {(id, by) => <Input id={id} aria-describedby={by} value="India" readOnly disabled className="h-11 sm:h-9" />}
        </Field>
        <Field label="Address" hint="House or flat, building, street and area." error={errors.addressLine} className="sm:col-span-2">
          {(id, by) => <Input id={id} aria-describedby={by} aria-invalid={!!errors.addressLine} value={d.addressLine} onChange={set("addressLine")} autoComplete="street-address" maxLength={200} className="h-11 sm:h-9" />}
        </Field>
        <Field label="City" error={errors.city}>
          {(id, by) => <Input id={id} aria-describedby={by} aria-invalid={!!errors.city} value={d.city} onChange={set("city")} autoComplete="address-level2" maxLength={80} className="h-11 sm:h-9" />}
        </Field>
        <Field label="PIN code" hint="6 digits." error={errors.pin}>
          {(id, by) => <Input id={id} aria-describedby={by} aria-invalid={!!errors.pin} value={d.pin} onChange={set("pin")} inputMode="numeric" autoComplete="postal-code" maxLength={6} className="h-11 sm:h-9" />}
        </Field>
        <Field label="State" error={errors.stateCode} className="sm:col-span-2">
          {(id, by) => (
            <select id={id} aria-describedby={by} aria-invalid={!!errors.stateCode} value={d.stateCode} onChange={set("stateCode")} autoComplete="address-level1" className={cn(tableSelectCls, "h-11 w-full sm:h-9")}>
              <option value="">Choose your state</option>
              {INDIA_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <div className="rounded-xl border p-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm sm:min-h-0">
          <input type="checkbox" checked={business} onChange={(e) => setBusiness(e.target.checked)} className="size-5 shrink-0 cursor-pointer rounded border-input accent-primary sm:size-4" />
          <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="font-medium">I&apos;m buying for a business</span>
          <InfoTip label="About business invoices">Add your GSTIN to get a business invoice with your company&apos;s name on it.</InfoTip>
        </label>
        {business && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="GSTIN" hint="15 characters, e.g. 27AAPFU0939F1ZV." error={errors.gstin}>
              {(id, by) => <Input id={id} aria-describedby={by} aria-invalid={!!errors.gstin} value={d.gstin} onChange={set("gstin")} maxLength={15} autoCapitalize="characters" className="h-11 uppercase sm:h-9" />}
            </Field>
            <Field label="Business name" hint="As registered with this GSTIN." error={errors.businessName}>
              {(id, by) => <Input id={id} aria-describedby={by} aria-invalid={!!errors.businessName} value={d.businessName} onChange={set("businessName")} autoComplete="organization" maxLength={150} className="h-11 sm:h-9" />}
            </Field>
          </div>
        )}
      </div>

      <Field label="PAN" optional hint="10 characters, e.g. ABCDE1234F." error={errors.pan}>
        {(id, by) => <Input id={id} aria-describedby={by} aria-invalid={!!errors.pan} value={d.pan} onChange={set("pan")} maxLength={10} autoCapitalize="characters" className="h-11 uppercase sm:h-9 sm:max-w-56" />}
      </Field>

      {serverError && (
        <p className="text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
        <Button type="submit" className="h-11 sm:h-9" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function BillingDetailsDialog({
  open,
  onOpenChange,
  initial,
  reason,
  submitLabel = "Save details",
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: BillingDetails;
  /** "checkout": shown before paying, so it says why it's asked. "add": first time, from Settings. */
  reason?: "checkout" | "add" | "edit";
  submitLabel?: string;
  onSave: (details: BillingDetails) => Promise<string | null>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{reason === "checkout" ? "Your billing details" : reason === "add" ? "Add billing details" : "Edit billing details"}</DialogTitle>
          <DialogDescription>
            {reason === "edit"
              ? "Changes apply to future invoices. Invoices you already have stay as they were."
              : "These go on your invoices. We ask for them once, and you can change them later in Settings, under Profile."}
          </DialogDescription>
        </DialogHeader>
        <BillingDetailsForm initial={initial} submitLabel={submitLabel} onSave={onSave} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
