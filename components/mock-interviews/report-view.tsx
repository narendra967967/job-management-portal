"use client";

import Link from "next/link";
import { ArrowLeft, Bell, Bot, CheckCircle2, Flag, Hourglass, Lightbulb, RotateCcw, Target, TriangleAlert, UserRound } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { SampleBanner } from "@/components/mock-interviews/sample-banner";
import { SAMPLE_CHAT, SAMPLE_SETTINGS, SAMPLE_WRITING, type SampleInterview } from "@/lib/mock-interviews/sample-data";
import { METRICS, SOURCE_LABELS, longDate, overallScore, scoreBand } from "@/lib/mock-interviews/model";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

// One report layout for AI and interviewer evaluations (spec D49): five metric
// scores, an overall score out of 100 and five written parts, always labeled
// with its source. R1.2: sample data.

export function ReportView({ interview }: { interview: SampleInterview }) {
  const mounted = useMounted();
  const human = interview.source === "human";
  const writing = SAMPLE_WRITING[interview.source];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <SampleBanner
        previews={[
          { label: "AI report", href: "/mock-interviews/report/ai-8", active: interview.id === "ai-8" },
          { label: "Interviewer report", href: "/mock-interviews/report/hu-1", active: interview.id === "hu-1" },
          { label: "Waiting for interviewer", href: "/mock-interviews/report/hu-2", active: interview.id === "hu-2" },
        ]}
      />
      <Link href="/mock-interviews/history" className="inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:min-h-0">
        <ArrowLeft className="size-3.5" aria-hidden />
        Interview history
      </Link>

      {/* Header */}
      <div className="rounded-xl border bg-card p-4 md:p-5">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            human ? "bg-orange-50 text-orange-800" : "bg-primary/10 text-primary",
          )}
        >
          {human ? <UserRound className="size-3.5" aria-hidden /> : <Bot className="size-3.5" aria-hidden />}
          {SOURCE_LABELS[interview.source]}
          {human && interview.interviewer ? ` · ${interview.interviewer}` : ""}
        </span>
        <h1 className="mt-2 text-lg font-semibold tracking-tight">{interview.role}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {interview.category} · {interview.difficulty} · {interview.durationMin} min
          {mounted ? ` · ${longDate(interview.date)}` : ""}
        </p>
      </div>

      {interview.status === "awaiting_report" ? (
        <AwaitingReport />
      ) : interview.scores ? (
        <>
          <Scores scores={interview.scores} />
          <Section icon={CheckCircle2} title="What went well" tone="text-emerald-600">
            <Bullets items={writing.strengths} />
          </Section>
          <Section icon={Target} title="What to improve" tone="text-amber-600">
            <Bullets items={writing.improvements} />
          </Section>
          <Section icon={TriangleAlert} title="Answers that missed something" tone="text-rose-600">
            <ul className="space-y-3">
              {writing.missed.map((m) => (
                <li key={m.question}>
                  <p className="text-sm font-medium">{m.question}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{m.note}</p>
                </li>
              ))}
            </ul>
          </Section>
          <Section icon={Lightbulb} title="Better ways to answer" tone="text-primary">
            <ul className="space-y-3">
              {writing.betterAnswers.map((b) => (
                <li key={b.question} className="rounded-lg bg-muted/40 p-3">
                  <p className="text-sm font-medium">{b.question}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{b.answer}</p>
                </li>
              ))}
            </ul>
          </Section>
          <Section icon={RotateCcw} title="What to prepare next" tone="text-sky-600">
            <Bullets items={writing.nextSteps} />
          </Section>

          {!human && (
            <details className="group rounded-xl border bg-card p-4">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-medium sm:min-h-0">
                The full conversation
                <span className="text-xs font-normal text-muted-foreground group-open:hidden">Show</span>
                <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">Hide</span>
              </summary>
              <ol className="mt-3 space-y-2">
                {SAMPLE_CHAT.map((m) => (
                  <li key={m.id} className="text-sm">
                    <span className="font-medium">{m.from === "ai" ? "Interviewer" : "You"}: </span>
                    <span className="text-muted-foreground">{m.text}</span>
                  </li>
                ))}
              </ol>
            </details>
          )}

          <div className="flex flex-wrap gap-2">
            <Link href="/mock-interviews/ai/new" className={buttonVariants({ size: "lg" })}>
              <RotateCcw className="size-4" aria-hidden />
              Practice again
            </Link>
            {human && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => toast.info("Sample: this opens a support request", "You'd say what's wrong with the evaluation and we'd look into it.")}
              >
                <Flag className="size-4" aria-hidden />
                Report a problem with this evaluation
              </Button>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Scores({ scores }: { scores: NonNullable<SampleInterview["scores"]> }) {
  const overall = overallScore(scores, SAMPLE_SETTINGS.weights);
  return (
    <section className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-[10rem_1fr] md:p-5">
      <div className="flex items-center gap-3 md:flex-col md:items-start md:justify-center md:border-r md:pr-4">
        <p className="text-4xl font-semibold tabular-nums">
          {overall}
          <span className="text-base font-normal text-muted-foreground">/100</span>
        </p>
        <div>
          <p className="text-sm font-medium">{scoreBand(overall)}</p>
          <p className="text-xs text-muted-foreground">Overall score</p>
        </div>
      </div>
      <ul className="space-y-3" aria-label="Scores by skill, out of 10">
        {METRICS.map((m) => {
          const v = scores[m.key];
          return (
            <li key={m.key}>
              <div className="flex justify-between text-sm">
                <span>{m.label}</span>
                <span className="font-medium tabular-nums">
                  {v}
                  <span className="text-muted-foreground">/10</span>
                </span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full rounded-full bg-primary" style={{ width: `${v * 10}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AwaitingReport() {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <Hourglass className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
        <div className="text-sm">
          <p className="font-medium">Your interviewer hasn&apos;t sent the evaluation yet</p>
          <p className="mt-1 text-muted-foreground">
            Interviewers have 48 hours after the interview to send it. If it hasn&apos;t arrived after 40 hours, you can send
            them a reminder.
          </p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => toast.success("Sample: reminder sent", "Your interviewer gets an email and a notification.")}
          >
            <Bell className="size-4" aria-hidden />
            Remind my interviewer
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, tone, children }: { icon: typeof CheckCircle2; title: string; tone: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 md:p-5">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <Icon className={cn("size-4", tone)} aria-hidden />
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed marker:text-muted-foreground">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}
