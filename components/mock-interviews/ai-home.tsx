"use client";

import Link from "next/link";
import { ArrowRight, Clock, MessageSquareText, PlayCircle, Plus, Sparkles, FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SampleBanner } from "@/components/mock-interviews/sample-banner";
import { SAMPLE_INTERVIEWS, SAMPLE_SETTINGS } from "@/lib/mock-interviews/sample-data";
import { aiInterviewQuote, longDate, lowestRatePerMinute, overallScore, rupees, scoreBand, type AllowanceState } from "@/lib/mock-interviews/model";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

export function AiHome({ allowance, allowanceKey }: { allowance: AllowanceState; allowanceKey: string }) {
  const mounted = useMounted();
  const resumable = SAMPLE_INTERVIEWS.find((i) => i.source === "ai" && i.status === "interrupted");
  const last = SAMPLE_INTERVIEWS.find((i) => i.source === "ai" && i.status === "completed" && i.scores);
  const newHref = `/mock-interviews/ai/new?allowance=${allowanceKey}`;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <SampleBanner
        previews={[
          { label: "Plan allowance", href: "/mock-interviews/ai?allowance=plan", active: allowanceKey === "plan" },
          { label: "Free plan", href: "/mock-interviews/ai?allowance=free", active: allowanceKey === "free" },
          { label: "Nothing included", href: "/mock-interviews/ai?allowance=none", active: allowanceKey === "none" },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">AI mock interviews</h1>
        <Link href={newHref} className={buttonVariants({ size: "lg" })}>
          <Plus className="size-4" aria-hidden />
          New interview
        </Link>
      </div>

      {resumable && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center">
          <PlayCircle className="hidden size-6 shrink-0 text-primary sm:block" aria-hidden />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">Your interview stopped before the end</p>
            <p className="mt-0.5 text-muted-foreground">
              {resumable.role} · {resumable.category} · {resumable.durationMin} min. You can pick it up where you left off
              for {SAMPLE_SETTINGS.resumeWindowMinutes} minutes after it stopped.
            </p>
          </div>
          <Link href={`/mock-interviews/ai/session/${resumable.id}`} className={cn(buttonVariants(), "shrink-0")}>
            Resume interview
          </Link>
        </div>
      )}

      <AllowanceCard allowance={allowance} mounted={mounted} />

      {last?.scores && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Your last AI interview</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{last.role}</p>
              <p className="text-sm text-muted-foreground">
                {last.category} · {last.difficulty} · {last.durationMin} min
                {mounted ? ` · ${longDate(last.date)}` : ""}
              </p>
            </div>
            {(() => {
              const overall = overallScore(last.scores, SAMPLE_SETTINGS.weights);
              return (
                <p className="text-right">
                  <span className="text-2xl font-semibold tabular-nums">{overall}</span>
                  <span className="text-sm text-muted-foreground">/100 · {scoreBand(overall)}</span>
                </p>
              );
            })()}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/mock-interviews/report/${last.id}`} className={buttonVariants({ variant: "outline" })}>
              <FileText className="size-4" aria-hidden />
              View report
            </Link>
            <Link href="/mock-interviews/history" className={buttonVariants({ variant: "ghost" })}>
              All interviews
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      )}

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-medium">How it works</h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            { icon: Sparkles, title: "Set it up", text: "Pick the role, the kind of interview and how long. Add your resume and the job description." },
            { icon: MessageSquareText, title: "Answer in your own words", text: "The interviewer asks one question at a time and follows up when an answer needs more." },
            { icon: Clock, title: "Read your report", text: "Scores for five skills, what went well, what to fix and better ways to answer." },
          ].map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="flex gap-3 sm:flex-col sm:gap-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium">
                  {i + 1}. {title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function AllowanceCard({ allowance, mounted }: { allowance: AllowanceState; mounted: boolean }) {
  // Prices differ by difficulty (D5); quote the lowest, and a Medium example.
  const rate = rupees(lowestRatePerMinute(SAMPLE_SETTINGS.pricing));
  const example = aiInterviewQuote(30, SAMPLE_SETTINGS.pricing.Medium).final;
  let title: string;
  let text: string;
  if (allowance.kind === "plan") {
    const left = Math.max(0, allowance.included - allowance.used);
    title = `${left} of ${allowance.included} AI interviews left on your ${allowance.planName} plan`;
    text = `Your included interviews renew with your plan${mounted ? ` on ${longDate(allowance.periodEnds)}` : ""}; unused ones don't carry over. After that, interviews cost from ${rate} a minute, depending on difficulty.`;
  } else if (allowance.kind === "free") {
    title = allowance.left > 0 ? "Your free AI interview is ready" : "You've used your free AI interview";
    text =
      allowance.left > 0
        ? "The Free plan includes one AI interview, once. Use it at any length up to 60 minutes."
        : `Interviews now cost from ${rate} a minute, depending on difficulty. A 30-minute Medium interview is ${rupees(example)}.`;
  } else {
    title = "Pay per interview";
    text = `Interviews cost from ${rate} a minute, depending on difficulty. A 30-minute Medium interview is ${rupees(example)}. A paid plan includes some interviews.`;
  }
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
