"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlarmClock,
  ArrowLeft,
  Bot,
  Brain,
  CheckCircle2,
  Circle,
  Clock3,
  FileText,
  Flag,
  Headphones,
  Loader2,
  Lightbulb,
  ListChecks,
  MessageCircle,
  Mic,
  Pencil,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  Timer,
  Wifi,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { startInterviewAction } from "@/actions/mock-interviews";
import { LevelTag } from "@/components/mock-interviews/visual-kit";
import type { BriefingData } from "@/lib/mock-interviews/data";
import { METRICS, plannedQuestions, type MetricKey } from "@/lib/mock-interviews/model";
import { cn } from "@/lib/utils";

// The briefing page before an AI interview starts or resumes (spec D13e): what
// to expect, where they left off (when resuming), a short checklist and the
// rules that matter, then the one button that opens the interview screen.


const METRIC_ICON: Record<MetricKey, LucideIcon> = {
  communication: MessageCircle,
  technical: Wrench,
  confidence: Sparkles,
  problemSolving: Brain,
  relevance: Target,
};

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function InterviewBriefing({ data }: { data: BriefingData }) {
  const { booking, settings, answered, atQuestion, lastQuestion } = data;
  const resuming = booking.status === "interrupted" || booking.status === "in_progress";
  const questions = plannedQuestions(booking.durationMin, settings.minutesPerQuestion);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const sessionHref = `/mock-interviews/ai/session/${booking.id}`;

  const usedSeconds = data.activeSeconds;

  const checklist = [
    { key: "quiet", icon: Headphones, text: "I'm somewhere quiet where I won't be interrupted." },
    { key: "time", icon: Clock3, text: `I have about ${booking.durationMin + settings.wrapUpMinutes} minutes free, including the wrap-up time.` },
    { key: "net", icon: Wifi, text: "My internet connection is steady." },
    { key: "ready", icon: FileText, text: "I've looked over the job and my resume, so my examples are fresh." },
  ];
  const ticked = checklist.filter((c) => checked[c.key]).length;

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-20 lg:pb-0">
      <Link href="/mock-interviews/ai" className="inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:min-h-0">
        <ArrowLeft className="size-3.5" aria-hidden />
        AI mock interviews
      </Link>

      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div
          className={cn(
            "flex flex-col gap-4 p-4 sm:flex-row sm:items-center md:p-5",
            resuming ? "bg-gradient-to-r from-amber-500/15 via-orange-400/8 to-transparent" : "bg-gradient-to-r from-primary/12 via-violet-500/8 to-transparent",
          )}
        >
          <span
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm",
              resuming ? "bg-gradient-to-br from-amber-500 to-orange-500" : "bg-gradient-to-br from-primary to-violet-600",
            )}
          >
            {resuming ? <RefreshCw className="size-6" aria-hidden /> : <Bot className="size-6" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight">{resuming ? "Pick up where you left off" : "Get ready for your interview"}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {resuming
                ? "Your interview stopped before the end. Here's where you are, so you can carry on calmly."
                : "A few minutes here makes the interview go better. Read this, then start when you're ready."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-t px-4 py-3 text-xs md:px-5">
          <span className="font-semibold">{booking.role}</span>
          <span className="rounded-md border bg-white/70 px-1.5 py-0.5 text-muted-foreground">{booking.category}</span>
          <LevelTag level={booking.difficulty} />
          <span className="inline-flex items-center gap-1 rounded-md border bg-white/70 px-1.5 py-0.5 text-muted-foreground">
            <Clock3 className="size-3" aria-hidden />
            {booking.durationMin} min
          </span>
          <span className="rounded-md border bg-white/70 px-1.5 py-0.5 text-muted-foreground">about {questions} questions</span>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-4">
          {/* Resuming: where they are */}
          {resuming && (
            <section className="rounded-2xl border border-amber-200 bg-card p-4 shadow-sm md:p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold text-amber-900">
                <Timer className="size-5 text-amber-600" aria-hidden />
                Where you are
              </h2>
              <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Fact label="Question" value={`${atQuestion} of about ${questions}`} />
                <Fact label="Answers given" value={String(answered)} />
                <Fact label="Time used" value={`${mmss(usedSeconds)} of ${booking.durationMin}:00`} />
                <Fact
                  label="Resume within"
                  value={`${booking.resumeMinutesLeft ?? settings.resumeWindowMinutes} min`}
                  tone="text-amber-700"
                />
              </dl>
              {/* The progress so far, as dots like the interview screen's. */}
              <ol className="mt-3 flex flex-wrap gap-1.5" aria-label={`Question ${atQuestion} of about ${questions}`}>
                {Array.from({ length: questions }, (_, i) => (
                  <li
                    key={i}
                    aria-hidden
                    className={cn(
                      "size-2.5 rounded-full",
                      i + 1 < atQuestion ? "bg-emerald-500" : i + 1 === atQuestion ? "bg-amber-500 ring-4 ring-amber-200" : "bg-muted-foreground/20",
                    )}
                  />
                ))}
              </ol>
              {lastQuestion && (
                <div className="mt-3 rounded-xl bg-amber-50 p-3">
                  <p className="text-[11px] font-semibold tracking-wide text-amber-800 uppercase">The question waiting for you</p>
                  <p className="mt-1 text-sm leading-relaxed">{lastQuestion}</p>
                </div>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                The clock picks up from where it stopped. Everything you&apos;ve answered so far is kept and counts toward your report.
              </p>
            </section>
          )}

          {/* What to expect */}
          <section className="rounded-2xl border bg-card p-4 shadow-sm md:p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <ListChecks className="size-5 text-primary" aria-hidden />
              What to expect
            </h2>
            <ol className="mt-3 space-y-3">
              {[
                { icon: MessageCircle, title: "One question at a time", text: `About ${questions} questions planned around your role, the job and your topics. The interviewer asks follow-ups when an answer needs more.` },
                { icon: Timer, title: `${booking.durationMin} minutes on the clock`, text: `A timer shows the time left. If time runs out mid-answer, the interviewer takes up to ${settings.wrapUpMinutes} more minutes to wrap up, then ends.` },
                { icon: Mic, title: "Type or speak", text: "Type your answers, or tap the mic to speak and check the words before sending. Speaking works in Chrome, Edge and Safari." },
                { icon: FileText, title: "Your report straight after", text: "Scores for five skills, what went well, what to fix and better ways to answer. It usually takes under a minute." },
              ].map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-violet-600 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      <Icon className="size-3.5 text-primary" aria-hidden />
                      {title}
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Checklist */}
          <section className="rounded-2xl border bg-card p-4 shadow-sm md:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <CheckCircle2 className="size-5 text-emerald-600" aria-hidden />
                Before you {resuming ? "carry on" : "start"}
              </h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {ticked} of {checklist.length}
              </span>
            </div>
            <ul className="mt-3 space-y-2">
              {checklist.map(({ key, icon: Icon, text }) => {
                const on = !!checked[key];
                return (
                  <li key={key}>
                    <label
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors",
                        on ? "border-emerald-300 bg-emerald-50" : "bg-white/60 hover:border-emerald-200",
                      )}
                    >
                      <input type="checkbox" className="sr-only" checked={on} onChange={() => setChecked((c) => ({ ...c, [key]: !c[key] }))} />
                      {on ? <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-hidden /> : <Circle className="size-5 shrink-0 text-muted-foreground/40" aria-hidden />}
                      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span>{text}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">Optional, but worth a moment.</p>
          </section>

          {/* Good to know */}
          <section className="rounded-2xl border border-rose-200 bg-card p-4 shadow-sm md:p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-rose-800">
              <ShieldAlert className="size-5 text-rose-600" aria-hidden />
              Good to know
            </h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              <Note icon={RefreshCw}>
                If your connection drops or the tab closes, you can resume within {settings.resumeWindowMinutes} minutes from where
                you stopped.
              </Note>
              <Note icon={Flag}>Ending early is allowed. Questions you haven&apos;t answered won&apos;t be scored.</Note>
              {!resuming && <Note icon={AlarmClock}>Once you start, this booking is used. It can&apos;t be started again from the beginning.</Note>}
              <Note icon={Lightbulb}>Use real examples from your own work. Specific answers score better than general ones.</Note>
            </ul>
          </section>
        </div>

        {/* Side: setup, what's scored, the button */}
        <aside className="space-y-4 lg:sticky lg:top-0">
          <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="bg-gradient-to-br from-primary to-violet-600 p-4 text-white">
              <p className="text-[11px] font-semibold tracking-wide text-white/75 uppercase">Your setup</p>
              <p className="mt-1 font-semibold">{booking.role}</p>
            </div>
            <dl className="space-y-2 p-4 text-sm">
              <SetupRow label="Industry" value={booking.industry} />
              <SetupRow label="Resume" value="Your default saved resume" />
              <SetupRow label="Job description" value="General preparation" />
              <div>
                <dt className="text-xs text-muted-foreground">Topics</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {booking.topics.map((t) => (
                    <span key={t} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {t}
                    </span>
                  ))}
                </dd>
              </div>
              {!resuming && (
                <Link href={`/mock-interviews/ai/new?edit=${booking.id}`} className={cn(buttonVariants({ variant: "ghost" }), "mt-1 px-0 text-xs")}>
                  <Pencil className="size-3.5" aria-hidden />
                  Edit setup
                </Link>
              )}
            </dl>
          </section>

          <section className="rounded-2xl border bg-card p-4 shadow-sm">
            <h2 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Scored at the end</h2>
            <ul className="mt-2.5 space-y-1.5">
              {METRICS.map((m) => {
                const Icon = METRIC_ICON[m.key];
                return (
                  <li key={m.key} className="flex items-center gap-2 text-sm">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                    {m.label}
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="hidden space-y-2 lg:block">
            <StartButton resuming={resuming} href={sessionHref} />
            <Link href="/mock-interviews/ai" className={cn(buttonVariants({ variant: "ghost" }), "w-full")}>
              Not now
            </Link>
          </div>
        </aside>
      </div>

      {/* Phones and tablets: the button stays in reach (right padding clears the help bubble). */}
      <div className="sticky bottom-0 z-10 -mx-1 flex items-center gap-3 rounded-2xl border bg-card/95 p-3 pr-[4.75rem] shadow-md backdrop-blur sm:pr-[5.25rem] lg:hidden">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          {resuming ? `${booking.resumeMinutesLeft ?? settings.resumeWindowMinutes} min left to resume` : `${booking.durationMin} min · about ${questions} questions`}
        </p>
        <StartButton resuming={resuming} href={sessionHref} compact />
      </div>
    </div>
  );
}

/**
 * Starts the interview on the server first (the AI writes the question plan,
 * which takes a few seconds), then opens the interview screen. Resuming goes
 * straight in.
 */
function StartButton({ resuming, href, compact }: { resuming: boolean; href: string; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const id = href.split("/").pop() ?? "";
  async function go() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await startInterviewAction(id);
      if (!r.ok) {
        toast.error(resuming ? "Couldn't resume" : "Couldn't start", r.error);
        setBusy(false);
        return;
      }
      router.push(href);
    } catch {
      toast.error("Something went wrong", "Check your connection and try again.");
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={go}
      disabled={busy}
      className={cn(
        buttonVariants({ size: "lg" }),
        compact ? "shrink-0" : "w-full",
        "text-white shadow-sm hover:opacity-90",
        resuming ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-gradient-to-r from-primary to-violet-600",
      )}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
      ) : resuming ? (
        <RefreshCw className="size-4" aria-hidden />
      ) : (
        <PlayCircle className="size-4" aria-hidden />
      )}
      {busy ? (resuming ? "Resuming…" : "Preparing your questions…") : resuming ? "Resume interview" : "Start interview"}
    </button>
  );
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm font-semibold tabular-nums", tone)}>{value}</dd>
    </div>
  );
}

function SetupRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Note({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-rose-500" aria-hidden />
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
