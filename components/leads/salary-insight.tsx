"use client";

// AI salary insight (#9, premium) — the saved estimate for a job, a dialog
// (from the card's ⋯ menu) and a section for the lead detail page. Generating
// sends the job + default résumé to the user's AI key; the server validates
// and saves the result on the job.

import { useState } from "react";
import { Info, Lock, Loader2, RefreshCw, Sparkles, Wallet } from "lucide-react";
import type { JobLead, SalaryInsight } from "@/lib/types";
import { generateSalaryInsight, useFeatures, useLeadDetail } from "@/lib/mock-store";
import { PremiumLockedDialog } from "@/components/premium/premium-locked-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatDateTime } from "@/lib/utils";
import { useMounted } from "@/lib/use-mounted";

const LOCKED_COPY =
  "Get an AI estimate of what this job should pay — based on the role, location and your résumé — so you know what to ask for.";

function money(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString("en-IN")}`;
  }
}

/** "≈ 18.5 L/yr" for Indian rupee figures (how salaries are usually quoted). */
function lakhs(n: number, currency: string): string | null {
  if (currency !== "INR" || n < 100_000) return null;
  return `≈ ${(n / 100_000).toFixed(n >= 10_000_000 ? 0 : 1)} L/yr`;
}

const CONFIDENCE: Record<SalaryInsight["confidence"], { label: string; cls: string }> = {
  low: { label: "Low confidence", cls: "bg-status-shortlisted text-status-shortlisted-foreground" },
  medium: { label: "Medium confidence", cls: "bg-status-new text-status-new-foreground" },
  high: { label: "High confidence", cls: "bg-status-applied text-status-applied-foreground" },
};

/** The saved estimate: range tiles, suggested ask, reasons, tips, caveat. */
export function SalaryInsightView({ insight }: { insight: SalaryInsight }) {
  const mounted = useMounted(); // the date is locale-dependent → client-only
  const c = insight.currency;
  const conf = CONFIDENCE[insight.confidence];
  return (
    <div className="space-y-4">
      {/* Phones: full-width rows (label · amount); sm+: three tiles. */}
      <div className="grid gap-2 sm:grid-cols-3">
        {(
          [
            ["Low", insight.low],
            ["Typical", insight.typical],
            ["High", insight.high],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="flex min-w-0 items-baseline justify-between gap-2 rounded-xl border bg-muted/30 px-3 py-2 sm:block sm:p-2.5"
          >
            <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
            <p className="text-right sm:text-left">
              <span className="text-sm font-semibold tabular-nums">{money(value, c)}</span>
              {lakhs(value, c) && (
                <span className="ml-1.5 text-[11px] text-muted-foreground tabular-nums sm:ml-0 sm:block">
                  {lakhs(value, c)}
                </span>
              )}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Suggested ask</p>
          <p className="text-lg font-semibold text-primary tabular-nums">
            {money(insight.suggestedAsk, c)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">/ year</span>
          </p>
        </div>
        <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium", conf.cls)}>
          {conf.label}
        </span>
      </div>

      {insight.summary && <p className="text-sm">{insight.summary}</p>}

      {insight.factors.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground">What drives this</h4>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
            {insight.factors.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      {insight.tips.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground">Negotiation tips</h4>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
            {insight.tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          AI estimate for the {insight.basis.country} market
          {insight.basis.marketSource === "location"
            ? " (from the job's location)"
            : insight.basis.marketSource === "inferred"
              ? " (inferred — the location didn't say)"
              : ""}
          {insight.basis.resumeLabel ? `, using your résumé “${insight.basis.resumeLabel}”` : ""}
          {mounted ? ` · ${formatDateTime(insight.generatedAt)}` : ""}. Based on the model&apos;s general knowledge — not
          live salary data. Use it as a starting point and check current listings.
        </span>
      </p>
    </div>
  );
}

/** Generate / regenerate button + error, shared by the dialog and the section. */
function useGenerate(leadId: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run() {
    setBusy(true);
    setError("");
    const res = await generateSalaryInsight(leadId);
    if (!res.ok) setError(res.error);
    setBusy(false);
  }
  return { busy, error, run };
}

function GenerateButton({
  busy,
  hasInsight,
  onClick,
}: {
  busy: boolean;
  hasInsight: boolean;
  onClick: () => void;
}) {
  return (
    <Button onClick={onClick} disabled={busy} variant={hasInsight ? "outline" : "default"}>
      {busy ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : hasInsight ? (
        <RefreshCw className="size-4" aria-hidden />
      ) : (
        <Sparkles className="size-4" aria-hidden />
      )}
      {busy ? "Estimating…" : hasInsight ? "Regenerate" : "Estimate my salary"}
    </Button>
  );
}

/** Opened from the job card's ⋯ menu. */
export function SalaryInsightDialog({ lead, onClose }: { lead: JobLead; onClose: () => void }) {
  const { salaryInsight: allowed } = useFeatures();
  const insight = useLeadDetail(lead.id)?.salaryInsight ?? null;
  const { busy, error, run } = useGenerate(lead.id);

  if (!allowed) {
    return <PremiumLockedDialog feature="AI salary insight" description={LOCKED_COPY} onClose={onClose} />;
  }
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="size-4 text-primary" aria-hidden />
            Salary insight
          </DialogTitle>
          <DialogDescription>
            {lead.title} · {lead.company}
          </DialogDescription>
        </DialogHeader>
        {insight ? (
          <SalaryInsightView insight={insight} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Uses this job&apos;s description and location plus your default résumé to
            estimate a fair salary range and what to ask for.
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <GenerateButton busy={busy} hasInsight={!!insight} onClick={() => void run()} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Section on the lead detail page. */
export function SalaryInsightSection({ lead }: { lead: JobLead }) {
  const { salaryInsight: allowed } = useFeatures();
  const insight = useLeadDetail(lead.id)?.salaryInsight ?? null;
  const { busy, error, run } = useGenerate(lead.id);
  const [lockedOpen, setLockedOpen] = useState(false);

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-medium">
          <Wallet className="size-4 text-primary" aria-hidden />
          Salary insight
          <span className="rounded-md bg-top-choice/15 px-1.5 py-0.5 text-[10px] font-semibold text-top-choice-foreground">
            Premium
          </span>
        </h2>
        {allowed ? (
          <GenerateButton busy={busy} hasInsight={!!insight} onClick={() => void run()} />
        ) : (
          <Button variant="outline" onClick={() => setLockedOpen(true)}>
            <Lock className="size-4" aria-hidden />
            Unlock
          </Button>
        )}
      </div>
      <div className="mt-3">
        {allowed && insight ? (
          <SalaryInsightView insight={insight} />
        ) : (
          <p className="text-xs text-muted-foreground">
            {allowed
              ? "Estimate a fair salary range for this job from its description, location and your default résumé."
              : LOCKED_COPY}
          </p>
        )}
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
      {lockedOpen && (
        <PremiumLockedDialog
          feature="AI salary insight"
          description={LOCKED_COPY}
          onClose={() => setLockedOpen(false)}
        />
      )}
    </section>
  );
}
