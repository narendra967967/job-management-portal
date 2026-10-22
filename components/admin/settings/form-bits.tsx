"use client";

// Small form helpers shared by the admin Settings sections.

import { Button } from "@/components/admin/ui/button";
import { Label } from "@/components/admin/ui/label";
import { cn } from "@/lib/utils";

export const selectCls =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function SubHead({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-5 mb-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{children}</h3>;
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 cursor-pointer rounded border-input accent-primary" />
      <span>
        {label}
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

export function SaveRow({ busy, saved, error, onSave, label = "Save changes" }: { busy: boolean; saved: boolean; error: string; onSave: () => void; label?: string }) {
  return (
    <>
      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={onSave} disabled={busy}>{busy ? "Saving…" : label}</Button>
        {saved && <span className="text-xs text-status-applied-foreground">Saved</span>}
      </div>
    </>
  );
}
