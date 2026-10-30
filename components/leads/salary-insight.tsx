"use client";

// AI salary insight (#9, premium) — the saved estimate for a job, a dialog
// (from the card's ⋯ menu) and a section for the lead detail page. Generating
// sends the job + default résumé to the user's AI key; the server fixes the pay
// market (job location → profile country → mobile code → India), validates the
// answer and saves it on the job.

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  Info,
  Lock,
  Loader2,
  RefreshCw,
  Sparkles,
  Wallet,
} from "lucide-react";
import type { JobLead, SalaryInsight } from "@/lib/types";
import {
  generateSalaryInsight,
  useFeatures,
  useLeadDetail,
  useProfile,
} from "@/lib/mock-store";
import { resolveSalaryMarket, type MarketSource } from "@/lib/geo";
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

// Confidence is a state → status colours, always with an icon + label.
const CONFIDENCE: Record<
  SalaryInsight["confidence"],
  { label: string; cls: string; icon: typeof Info }
> = {
  low: {
    label: "Low confidence",
    cls: "bg-status-shortlisted text-status-shortlisted-foreground",
    icon: AlertTriangle,
  },
  medium: {
    label: "Medium confidence",
    cls: "bg-status-new text-status-new-foreground",
    icon: Info,
  },
  high: {
    label: "High confidence",
    cls: "bg-status-applied text-status-applied-foreground",
    icon: CheckCircle2,
  },
};

const SOURCE_TEXT: Record<MarketSource | "inferred", string> = {
  location: "from the job's location",
  profile: "from your profile country — the job's location doesn't say",
  mobile: "from your mobile number's country code — the job's location doesn't say",
  default: "default — the job's location doesn't say and no country is set",
  inferred: "inferred by the AI (older estimate)",
};

/**
 * Which pay market an estimate uses (or will use) and why, plus how the app
 * chooses it. Nudges the user to set their country when it had to fall back.
 */
function MarketNote({ lead, insight }: { lead: JobLead; insight: SalaryInsight | null }) {
  const profile = useProfile();
  const planned = resolveSalaryMarket({
    location: lead.location,
    profileCountry: profile.country,
    mobile: profile.mobile,
  });
  const market = insight ? insight.basis.country : planned.market;
  const currency = insight ? insight.currency : planned.currency;
  const source = insight ? (insight.basis.marketSource ?? "inferred") : planned.source;
  const nudge = source === "mobile" || source === "default";

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
      <p className="flex items-start gap-1.5">
        <Globe className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
        <span>
          <span className="font-medium">
            {insight ? "Market used" : "Market"}: {market} · {currency}
          </span>{" "}
          <span className="text-muted-foreground">({SOURCE_TEXT[source]})</span>
        </span>
      </p>
      {nudge && (
        <p className="mt-1.5 pl-5 text-muted-foreground">
          For remote jobs, estimates follow where <em>you</em> live.{" "}
          <Link
            href="/settings?tab=profile"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Set your country in Settings → Profile
          </Link>{" "}
          so they use the right market.
        </p>
      )}
      <details className="mt-1.5 pl-5 text-muted-foreground">
        <summary className="cursor-pointer py-1 font-medium text-foreground/80 select-none">
          How is the market chosen?
        </summary>
        <ol className="mt-1 list-decimal space-y-0.5 pl-4">
          <li>The job&apos;s location — a country, city or region like “Remote (EU)”.</li>
          <li>If that doesn&apos;t say, the country in your profile.</li>
          <li>Otherwise, your mobile number&apos;s country code.</li>
          <li>If none of these is available, India.</li>
        </ol>
        <p className="mt-1">Figures are always in that market&apos;s currency.</p>
      </details>
    </div>
  );
}

/**
 * Range bar: the low → high band on a track (one hue, lighter → darker as pay
 * rises), a dot for Typical and a pin for the suggested ask. Values are always
 * printed underneath, so nothing relies on colour or hover alone.
 */
function SalaryRange({ insight }: { insight: SalaryInsight }) {
  const c = insight.currency;
  const { low, typical, high, suggestedAsk: ask } = insight;
  const lo = Math.min(low, ask);
  const hi = Math.max(high, ask);
  const pad = (hi - lo) * 0.18 || hi * 0.1;
  const min = Math.max(0, lo - pad);
  const max = hi + pad;
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const askPct = Math.min(92, Math.max(8, pct(ask)));

  const legend = [
    { label: "Low", value: low, swatch: "rounded-sm bg-primary/60", align: "text-left", justify: "" },
    {
      label: "Typical",
      value: typical,
      swatch: "rounded-full bg-primary",
      align: "text-center",
      justify: "justify-center",
    },
    { label: "High", value: high, swatch: "rounded-sm bg-primary", align: "text-right", justify: "justify-end" },
  ];

  return (
    <div>
      <div
        role="img"
        aria-label={`Estimated range ${money(low, c)} to ${money(high, c)} a year, typical ${money(typical, c)}, suggested ask ${money(ask, c)}.`}
        className="relative pt-7 pb-1"
      >
        {/* Your ask: pin above the bar */}
        <div
          className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
          style={{ left: `${askPct}%` }}
          title={`Your ask: ${money(ask, c)}`}
        >
          <span className="rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-background">
            Your ask
          </span>
          <span className="size-0 border-x-4 border-t-[5px] border-x-transparent border-t-foreground" />
        </div>
        {/* Track + band */}
        <div className="relative h-3 rounded-full bg-muted">
          <div
            className="absolute inset-y-0 rounded-full bg-gradient-to-r from-primary/60 to-primary"
            style={{ left: `${pct(low)}%`, width: `${Math.max(2, pct(high) - pct(low))}%` }}
            title={`${money(low, c)} – ${money(high, c)}`}
          />
          {/* Typical: dot with a surface ring so it reads against the band */}
          <span
            className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-[3px] ring-card"
            style={{ left: `${pct(typical)}%` }}
            title={`Typical: ${money(typical, c)}`}
          />
          {/* Ask tick on the bar */}
          <span
            className="absolute top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
            style={{ left: `${pct(ask)}%` }}
          />
        </div>
      </div>

      {/* Values — the legend doubles as the data table */}
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        {legend.map((item) => (
          <div key={item.label} className={cn("min-w-0", item.align)}>
            <dt className={cn("flex items-center gap-1 text-muted-foreground", item.justify)}>
              <span className={cn("inline-block size-2.5 shrink-0", item.swatch)} aria-hidden />
              {item.label}
            </dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums">{money(item.value, c)}</dd>
            {lakhs(item.value, c) && (
              <dd className="text-[11px] text-muted-foreground tabular-nums">
                {lakhs(item.value, c)}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}

/** The saved estimate: headline ask, range bar, reasons, tips, caveat. */
export function SalaryInsightView({ insight }: { insight: SalaryInsight }) {
  const mounted = useMounted(); // the date is locale-dependent → client-only
  const c = insight.currency;
  const conf = CONFIDENCE[insight.confidence];
  const ConfIcon = conf.icon;
  return (
    <div className="space-y-4">
      {/* Headline: the number to take into the negotiation */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Suggested ask</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
            {money(insight.suggestedAsk, c)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">/ year</span>
          </p>
          {lakhs(insight.suggestedAsk, c) && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {lakhs(insight.suggestedAsk, c)}
            </p>
          )}
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",
            conf.cls,
          )}
        >
          <ConfIcon className="size-3.5" aria-hidden />
          {conf.label}
        </span>
      </div>

      <SalaryRange insight={insight} />

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
          AI estimate
          {insight.basis.resumeLabel ? ` using your résumé “${insight.basis.resumeLabel}”` : ""}
          {mounted ? ` · ${formatDateTime(insight.generatedAt)}` : ""}. Based on the model&apos;s
          general knowledge — not live salary data. Use it as a starting point and check current
          listings.
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
    return (
      <PremiumLockedDialog feature="AI salary insight" description={LOCKED_COPY} onClose={onClose} />
    );
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
        <MarketNote lead={lead} insight={insight} />
        {insight ? (
          <SalaryInsightView insight={insight} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Uses this job&apos;s description and location plus your default résumé to estimate a
            fair salary range and what to ask for.
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
          {!allowed && <span className="rounded-md bg-top-choice/15 px-1.5 py-0.5 text-[10px] font-semibold text-top-choice-foreground">
            On higher plans
          </span>}
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
      <div className="mt-3 space-y-3">
        {allowed && <MarketNote lead={lead} insight={insight} />}
        {allowed && insight ? (
          <SalaryInsightView insight={insight} />
        ) : (
          <p className="text-xs text-muted-foreground">
            {allowed
              ? "Estimate a fair salary range for this job from its description, location and your default résumé."
              : LOCKED_COPY}
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
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
