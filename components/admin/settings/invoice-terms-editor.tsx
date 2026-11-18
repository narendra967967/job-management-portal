"use client";

// Admin Settings → Billing → Invoice terms (docs/invoices/spec.md, section 10a):
// up to 5 short points printed under every invoice, one set per kind of sale.
// Each invoice keeps the terms it was issued with, so edits here only reach
// invoices issued afterwards.

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { cn } from "@/lib/utils";

export const INVOICE_TERMS_MAX = 5;
export const INVOICE_TERM_MAX_CHARS = 300;

const textareaCls =
  "field-sizing-content min-h-16 w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** One kind of sale's points: numbered boxes, add up to 5, remove any. */
export function InvoiceTermsEditor({
  label,
  terms,
  onChange,
  emptyNote,
}: {
  label: string;
  terms: string[];
  onChange: (next: string[]) => void;
  /** Shown when the list is empty. */
  emptyNote: string;
}) {
  const set = (i: number, v: string) => onChange(terms.map((t, j) => (j === i ? v : t)));
  return (
    <fieldset className="space-y-2 rounded-xl border p-3">
      <legend className="px-1 text-sm font-medium">{label}</legend>
      {terms.length === 0 && <p className="text-xs text-muted-foreground">{emptyNote}</p>}
      <ol className="space-y-2">
        {terms.map((t, i) => {
          const tooLong = t.length > INVOICE_TERM_MAX_CHARS;
          return (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-2 w-5 shrink-0 text-right text-sm text-muted-foreground">{i + 1}.</span>
              <div className="min-w-0 flex-1">
                <textarea
                  className={cn(textareaCls, tooLong && "border-destructive")}
                  value={t}
                  onChange={(e) => set(i, e.target.value)}
                  aria-label={`${label}, point ${i + 1}`}
                  aria-invalid={tooLong || !t.trim()}
                />
                <span className={cn("block text-right text-[11px]", tooLong ? "text-destructive" : "text-muted-foreground")}>
                  {!t.trim() ? "Write the point, or remove it." : `${t.length} / ${INVOICE_TERM_MAX_CHARS}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onChange(terms.filter((_, j) => j !== i))}
                aria-label={`Remove point ${i + 1}`}
                className="mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive sm:size-9"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          );
        })}
      </ol>
      {terms.length < INVOICE_TERMS_MAX && (
        <Button type="button" variant="outline" size="sm" className="min-h-11 gap-1.5 sm:min-h-9" onClick={() => onChange([...terms, ""])}>
          <Plus className="size-4" aria-hidden />
          Add a point
        </Button>
      )}
    </fieldset>
  );
}

/** Problem with a set of terms, or "" when it's fine. */
export function invoiceTermsError(label: string, terms: string[]): string {
  if (terms.length > INVOICE_TERMS_MAX) return `${label}: at most ${INVOICE_TERMS_MAX} points.`;
  if (terms.some((t) => !t.trim())) return `${label}: a point is empty. Write it or remove it.`;
  if (terms.some((t) => t.length > INVOICE_TERM_MAX_CHARS)) return `${label}: keep each point under ${INVOICE_TERM_MAX_CHARS} characters.`;
  return "";
}
