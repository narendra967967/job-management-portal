"use client";

// Per-résumé ATS score strip (Settings → Resumes) + its details dialog.
// The server decides access (actions/ats.ts); this only mirrors the state:
// premium lock → add AI key → complete career profile → readable text → check.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Gauge, Loader2, Lock, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { getAtsOverviewAction, runAtsCheckAction } from "@/actions/ats";
import { atsTone, type AtsCheckView, type AtsOverview } from "@/lib/ats-model";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { PremiumLockedDialog } from "@/components/premium/premium-locked-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Load the overview once, and again whenever `depKey` (résumé list) changes. */
export function useAtsOverview(depKey: string) {
  const [overview, setOverview] = useState<AtsOverview | null>(null);
  const refresh = useCallback(() => {
    getAtsOverviewAction()
      .then(setOverview)
      .catch(() => setOverview(null));
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh, depKey]);
  return { overview, setOverview, refresh };
}

const TONE_CLS = {
  good: "bg-status-applied text-status-applied-foreground",
  fair: "bg-status-shortlisted text-status-shortlisted-foreground",
  poor: "bg-destructive/10 text-destructive",
} as const;

const BAR_CLS = {
  good: "bg-status-applied-foreground",
  fair: "bg-status-shortlisted-foreground",
  poor: "bg-destructive",
} as const;

const LOCKED_COPY =
  "Check how well each résumé would pass an applicant tracking system (ATS): keywords and skills for your target roles, standard sections, measurable impact and contact details — with specific fixes.";

export function ResumeAtsStrip({
  resumeId,
  resumeLabel,
  hasText,
  overview,
  onChecked,
}: {
  resumeId: string;
  resumeLabel: string;
  hasText: boolean;
  overview: AtsOverview | null;
  onChecked: (resumeId: string, check: AtsCheckView) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState(false);
  const [locked, setLocked] = useState(false);

  if (!overview) {
    return <div className="mt-2.5 h-11 animate-pulse rounded-lg bg-muted/40 sm:h-9" aria-hidden />;
  }
  const check = overview.checks[resumeId];

  async function run() {
    setBusy(true);
    const res = await runAtsCheckAction(resumeId);
    setBusy(false);
    if (!res.ok) {
      toast.error("ATS check failed", res.error);
      return;
    }
    onChecked(resumeId, res.check);
    setDetails(true);
  }

  const wrap = "mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-2.5 text-xs";
  const hint = (icon: React.ReactNode, children: React.ReactNode) => (
    <div className={cn(wrap, "text-muted-foreground")}>
      <Gauge className="size-4 shrink-0" aria-hidden />
      <span className="font-medium text-foreground">ATS score</span>
      <span className="flex min-w-0 items-center gap-1.5">
        {icon}
        {children}
      </span>
    </div>
  );

  if (!overview.allowed) {
    return (
      <>
        <div className={wrap}>
          <Gauge className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="font-medium">ATS score</span>
          <button
            type="button"
            onClick={() => setLocked(true)}
            className="inline-flex min-h-11 items-center gap-1 rounded-md px-1 font-medium text-primary hover:underline sm:min-h-8"
          >
            <Lock className="size-3.5" aria-hidden />
            On higher plans — see what it does
          </button>
        </div>
        {locked && <PremiumLockedDialog feature="Résumé ATS check" description={LOCKED_COPY} onClose={() => setLocked(false)} />}
      </>
    );
  }
  if (!overview.hasAiKey) {
    return hint(
      null,
      <Link href="/settings?tab=ai" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline sm:min-h-8">
        Add your AI key to check it
      </Link>,
    );
  }
  if (!overview.profileComplete) {
    return hint(
      null,
      <Link href="/settings?tab=career" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline sm:min-h-8">
        Complete your career profile ({overview.profilePercent}%) to check it
      </Link>,
    );
  }
  if (!hasText) {
    return hint(<TriangleAlert className="size-3.5 shrink-0" aria-hidden />, "No résumé text yet — add it with the résumé-text button to check it.");
  }

  return (
    <div className={wrap}>
      <Gauge className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="font-medium">ATS score</span>
      {check ? (
        <>
          <button
            type="button"
            onClick={() => setDetails(true)}
            aria-label={`ATS score ${check.result.score} out of 100 — view details`}
            className={cn(
              "inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-semibold tabular-nums sm:min-h-7",
              TONE_CLS[atsTone(check.result.score)],
            )}
          >
            {check.result.score}
            <span className="text-[10px] font-medium opacity-70">/100</span>
          </button>
          {check.outdated ? (
            <span className="inline-flex items-center gap-1 rounded bg-status-shortlisted px-1.5 py-0.5 text-[10px] font-medium text-status-shortlisted-foreground">
              Outdated
            </span>
          ) : (
            <span className="text-muted-foreground">{formatDateTime(check.checkedAt)}</span>
          )}
          <span className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setDetails(true)}>
              Details
            </Button>
            <Button variant="outline" size="sm" onClick={run} disabled={busy} className="bg-white/50">
              {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />}
              {busy ? "Checking…" : "Re-check"}
            </Button>
          </span>
        </>
      ) : (
        <Button variant="outline" size="sm" onClick={run} disabled={busy} className="ml-auto bg-white/50">
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />}
          {busy ? "Checking…" : "Check ATS score"}
        </Button>
      )}
      {check && (
        <AtsDetailsDialog
          open={details}
          onOpenChange={setDetails}
          label={resumeLabel}
          check={check}
          busy={busy}
          onRecheck={run}
        />
      )}
    </div>
  );
}

function AtsDetailsDialog({
  open,
  onOpenChange,
  label,
  check,
  busy,
  onRecheck,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  label: string;
  check: AtsCheckView;
  busy: boolean;
  onRecheck: () => void;
}) {
  const r = check.result;
  const tone = atsTone(r.score);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>ATS score · {label}</DialogTitle>
          <DialogDescription>
            Checked {formatDateTime(check.checkedAt)} against your career profile.
            {check.outdated && " Your résumé or profile changed since — re-check for an up-to-date score."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4">
          <span className={cn("flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl", TONE_CLS[tone])}>
            <span className="text-2xl leading-none font-semibold tabular-nums">{r.score}</span>
            <span className="text-[10px] font-medium opacity-70">/100</span>
          </span>
          <p className="text-sm text-muted-foreground">
            {tone === "good"
              ? "Strong — this résumé should parse and match well."
              : tone === "fair"
                ? "Decent — a few fixes below would lift it."
                : "Needs work — start with the fixes below."}
          </p>
        </div>

        <ul className="space-y-2.5">
          {r.parts.map((p) => (
            <li key={p.key}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium">
                  {p.label}
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    {p.weight}% · {p.source === "ai" ? "AI" : "checked"}
                  </span>
                </span>
                <span className="tabular-nums">{p.score}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", BAR_CLS[atsTone(p.score)])} style={{ width: `${p.score}%` }} />
              </div>
            </li>
          ))}
        </ul>

        {r.fixes.length > 0 && (
          <div>
            <h3 className="text-sm font-medium">What to fix</h3>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm">
              {r.fixes.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ol>
          </div>
        )}

        {(r.matchedSkills.length > 0 || r.missingSkills.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {r.matchedSkills.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground">Found in your résumé</h3>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {r.matchedSkills.map((s) => (
                    <span key={s} className="rounded bg-status-applied px-1.5 py-0.5 text-[11px] text-status-applied-foreground">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {r.missingSkills.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground">Missing for your target roles</h3>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {r.missingSkills.map((s) => (
                    <span key={s} className="rounded bg-status-shortlisted px-1.5 py-0.5 text-[11px] text-status-shortlisted-foreground">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={onRecheck} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
            {busy ? "Checking…" : "Re-check"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
