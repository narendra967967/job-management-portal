"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bot,
  CheckCircle2,
  Flag,
  Hourglass,
  Lightbulb,
  ListChecks,
  MessagesSquare,
  Minus,
  RotateCcw,
  Target,
  TrendingUp,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { SampleBanner } from "@/components/mock-interviews/sample-banner";
import {
  SAMPLE_CHAT,
  SAMPLE_INTERVIEWS,
  SAMPLE_SETTINGS,
  SAMPLE_WRITING,
  type SampleInterview,
} from "@/lib/mock-interviews/sample-data";
import {
  METRICS,
  SOURCE_LABELS,
  longDate,
  overallScore,
  scoreBand,
  shortDate,
  type MetricScores,
  type ReportPoint,
} from "@/lib/mock-interviews/model";
import { useMounted } from "@/lib/use-mounted";
import { Sparkline, bandTone } from "@/components/mock-interviews/visual-kit";
import { cn } from "@/lib/utils";

// One report layout for AI and interviewer evaluations (spec D49). Visual first:
// the score, the skills chart, headlines and a table of the answers to work on.
// Every full explanation is still here, one tap away in a pop-up. R1.2: sample data.

type Modal = {
  title: string;
  description?: string;
  body: React.ReactNode;
} | null;


export function ReportView({ interview }: { interview: SampleInterview }) {
  const mounted = useMounted();
  const [modal, setModal] = useState<Modal>(null);
  const human = interview.source === "human";
  const writing = SAMPLE_WRITING[interview.source];

  // Earlier scored interviews (any source), oldest first, for the comparisons.
  const scored = SAMPLE_INTERVIEWS.filter(
    (i) => i.scores && i.date <= interview.date,
  ).sort((a, b) => a.date.localeCompare(b.date));
  const previous = [...scored].reverse().find((i) => i.id !== interview.id);
  const recent = scored.slice(-6);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <SampleBanner
        previews={[
          {
            label: "AI report",
            href: "/mock-interviews/report/ai-8",
            active: interview.id === "ai-8",
          },
          {
            label: "Interviewer report",
            href: "/mock-interviews/report/hu-1",
            active: interview.id === "hu-1",
          },
          {
            label: "Waiting for interviewer",
            href: "/mock-interviews/report/hu-2",
            active: interview.id === "hu-2",
          },
        ]}
      />
      <Link
        href="/mock-interviews/history"
        className="inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:min-h-0"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Interview history
      </Link>

      {interview.status === "awaiting_report" || !interview.scores ? (
        <>
          <Header interview={interview} mounted={mounted} />
          <AwaitingReport />
        </>
      ) : (
        <>
          <Hero
            interview={interview}
            scores={interview.scores}
            previous={previous}
            recent={recent}
            mounted={mounted}
          />
          <SkillsChart scores={interview.scores} previous={previous?.scores} />

          <div className="grid gap-4 md:grid-cols-2">
            <PointsCard
              title="What went well"
              icon={CheckCircle2}
              tone="emerald"
              points={writing.strengths}
              onOpen={() =>
                setModal({
                  title: "What went well",
                  body: <PointList points={writing.strengths} tone="emerald" />,
                })
              }
            />
            <PointsCard
              title="What to improve"
              icon={Target}
              tone="amber"
              points={writing.improvements}
              onOpen={() =>
                setModal({
                  title: "What to improve",
                  body: (
                    <PointList points={writing.improvements} tone="amber" />
                  ),
                })
              }
            />
          </div>

          <MissedTable writing={writing} onOpen={setModal} />
          <ActionPlan points={writing.nextSteps} />

          <div className="flex flex-wrap gap-2">
            <Link
              href="/mock-interviews/ai/new"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-gradient-to-r from-primary to-violet-600 text-white hover:opacity-90",
              )}
            >
              <RotateCcw className="size-4" aria-hidden />
              Practice again
            </Link>
            <Link
              href="/mock-interviews/performance"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <TrendingUp className="size-4" aria-hidden />
              See all your scores
            </Link>
            {!human && (
              <Button
                variant="outline"
                size="lg"
                onClick={() =>
                  setModal({
                    title: "The full conversation",
                    description: `${interview.role} · ${interview.durationMin} min`,
                    body: <Conversation />,
                  })
                }
              >
                <MessagesSquare className="size-4" aria-hidden />
                Read the conversation
              </Button>
            )}
            {human && (
              <Button
                variant="outline"
                size="lg"
                className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                onClick={() =>
                  toast.info(
                    "Sample: this opens a support request",
                    "You'd say what's wrong with the evaluation and we'd look into it.",
                  )
                }
              >
                <Flag className="size-4" aria-hidden />
                Report a problem
              </Button>
            )}
          </div>
        </>
      )}

      <Dialog open={modal !== null} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{modal?.title}</DialogTitle>
            {modal?.description && (
              <DialogDescription>{modal.description}</DialogDescription>
            )}
          </DialogHeader>
          {modal?.body}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- header pieces ---------------- */

function SourceBadge({ interview }: { interview: SampleInterview }) {
  const human = interview.source === "human";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        human
          ? "border-orange-200 bg-orange-50 text-orange-800"
          : "border-primary/20 bg-primary/10 text-primary",
      )}
    >
      {human ? (
        <UserRound className="size-3.5" aria-hidden />
      ) : (
        <Bot className="size-3.5" aria-hidden />
      )}
      {SOURCE_LABELS[interview.source]}
      {human && interview.interviewer ? ` · ${interview.interviewer}` : ""}
    </span>
  );
}

function Header({
  interview,
  mounted,
}: {
  interview: SampleInterview;
  mounted: boolean;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 md:p-5">
      <SourceBadge interview={interview} />
      <h1 className="mt-2 text-lg font-semibold tracking-tight">
        {interview.role}
      </h1>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {interview.category} · {interview.difficulty} · {interview.durationMin}{" "}
        min
        {mounted ? ` · ${longDate(interview.date)}` : ""}
      </p>
    </div>
  );
}

function Hero({
  interview,
  scores,
  previous,
  recent,
  mounted,
}: {
  interview: SampleInterview;
  scores: MetricScores;
  previous?: SampleInterview;
  recent: SampleInterview[];
  mounted: boolean;
}) {
  const w = SAMPLE_SETTINGS.weights;
  const overall = overallScore(scores, w);
  const tone = bandTone(overall);
  const prevOverall = previous?.scores
    ? overallScore(previous.scores, w)
    : null;
  const delta = prevOverall === null ? null : overall - prevOverall;
  const ranked = [...METRICS].sort((a, b) => scores[b.key] - scores[a.key]);
  const r = 42;
  const c = 2 * Math.PI * r;

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="bg-gradient-to-r from-primary/12 via-violet-500/8 to-transparent p-4 md:p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {/* Overall score ring */}
          <div className="flex items-center gap-4">
            <div className="relative size-28 shrink-0">
              <svg
                viewBox="0 0 100 100"
                className="size-full -rotate-90"
                aria-hidden
              >
                <circle
                  cx="50"
                  cy="50"
                  r={r}
                  className="fill-none stroke-muted"
                  strokeWidth="9"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={r}
                  className={cn("fill-none", tone.ring)}
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={c}
                  strokeDashoffset={c * (1 - overall / 100)}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-semibold tabular-nums">
                  {overall}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  out of 100
                </span>
              </div>
            </div>
            <div className="sm:hidden">
              <span
                className={cn(
                  "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                  tone.chip,
                )}
              >
                {scoreBand(overall)}
              </span>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <SourceBadge interview={interview} />
            <h1 className="mt-2 text-xl font-semibold tracking-tight">
              {interview.role}
            </h1>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
              {[
                interview.category,
                interview.difficulty,
                `${interview.durationMin} min`,
                mounted ? longDate(interview.date) : "",
              ]
                .filter(Boolean)
                .map((t) => (
                  <span
                    key={t}
                    className="rounded-md border bg-white/70 px-1.5 py-0.5 text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              <span
                className={cn(
                  "hidden rounded-full border px-2 py-0.5 font-semibold sm:inline-flex",
                  tone.chip,
                )}
              >
                {scoreBand(overall)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick facts */}
      <dl className="grid grid-cols-2 divide-x divide-y border-t sm:grid-cols-4 sm:divide-y-0">
        <Fact label="Since last time">
          {delta === null ? (
            <span className="text-muted-foreground">First report</span>
          ) : (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                delta > 0
                  ? "text-emerald-700"
                  : delta < 0
                    ? "text-rose-700"
                    : "text-muted-foreground",
              )}
            >
              {delta > 0 ? (
                <ArrowUpRight className="size-4" aria-hidden />
              ) : delta < 0 ? (
                <ArrowDownRight className="size-4" aria-hidden />
              ) : (
                <Minus className="size-4" aria-hidden />
              )}
              {delta > 0 ? `+${delta}` : delta}
              <span className="text-xs font-normal text-muted-foreground">
                points
              </span>
            </span>
          )}
        </Fact>
        <Fact label="Strongest">{ranked[0].label}</Fact>
        <Fact label="Focus on">{ranked[ranked.length - 1].label}</Fact>
        <Fact label="Your recent scores">
          <Sparkline
            values={recent.map((i) => overallScore(i.scores!, w))}
            labels={mounted ? recent.map((i) => shortDate(i.date)) : []}
          />
        </Fact>
      </dl>
    </section>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold">{children}</dd>
    </div>
  );
}


/* ---------------- skills ---------------- */

/** Bar per skill (this interview) with a tick for the last interview, so the change reads at a glance. */
function SkillsChart({
  scores,
  previous,
}: {
  scores: MetricScores;
  previous?: MetricScores;
}) {
  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Your skills</h2>
        {previous && (
          <ul
            className="flex items-center gap-3 text-[11px] text-muted-foreground"
            aria-label="Legend"
          >
            <li className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-full bg-primary" aria-hidden />
              This interview
            </li>
            <li className="flex items-center gap-1.5">
              <span
                className="h-3 w-0.5 rounded-full bg-slate-700"
                aria-hidden
              />
              Last interview
            </li>
          </ul>
        )}
      </div>
      <ul className="mt-4 space-y-3.5">
        {METRICS.map((m) => {
          const v = scores[m.key];
          const p = previous?.[m.key];
          const delta = p === undefined ? null : v - p;
          return (
            <li
              key={m.key}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[11rem_minmax(0,1fr)_5.5rem]"
            >
              <span className="text-sm">{m.label}</span>
              <span className="flex items-center justify-end gap-1.5 text-sm tabular-nums sm:order-3">
                <span className="font-semibold">{v}</span>
                <span className="text-muted-foreground">/10</span>
                {/* Fixed-width slot so scores line up whether or not they changed. */}
                <span className="inline-flex w-7 justify-end">
                  {delta !== null && delta !== 0 && (
                    <span
                      className={cn(
                        "inline-flex items-center rounded px-1 text-[10px] font-semibold",
                        delta > 0
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700",
                      )}
                      aria-label={`${delta > 0 ? "up" : "down"} ${Math.abs(delta)} since last time`}
                    >
                      {delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}
                    </span>
                  )}
                </span>
              </span>
              <div
                className="relative col-span-2 h-3 rounded-full bg-muted sm:order-2 sm:col-span-1"
                aria-hidden
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500"
                  style={{ width: `${v * 10}%` }}
                />
                {p !== undefined && (
                  <span
                    className="absolute top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-700"
                    style={{ left: `${p * 10}%` }}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------------- written parts ---------------- */

const TONES = {
  emerald: {
    head: "text-emerald-700",
    icon: "text-emerald-600",
    soft: "bg-emerald-50",
    border: "border-emerald-200",
  },
  amber: {
    head: "text-amber-800",
    icon: "text-amber-600",
    soft: "bg-amber-50",
    border: "border-amber-200",
  },
} as const;

function PointsCard({
  title,
  icon: Icon,
  tone,
  points,
  onOpen,
}: {
  title: string;
  icon: typeof CheckCircle2;
  tone: keyof typeof TONES;
  points: ReportPoint[];
  onOpen: () => void;
}) {
  const t = TONES[tone];
  return (
    <section
      className={cn("flex flex-col rounded-2xl border bg-card p-4", t.border)}
    >
      <h2
        className={cn("flex items-center gap-2 text-sm font-semibold", t.head)}
      >
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-lg",
            t.soft,
          )}
        >
          <Icon className={cn("size-4", t.icon)} aria-hidden />
        </span>
        {title}
      </h2>
      <ul className="mt-3 flex-1 space-y-2">
        {points.map((p) => (
          <li
            key={p.headline}
            className={cn("rounded-lg px-3 py-2 text-sm font-medium", t.soft)}
          >
            {p.headline}
          </li>
        ))}
      </ul>
      <Button
        variant="ghost"
        onClick={onOpen}
        className="mt-2 self-start text-xs"
      >
        Read the details
        <ArrowRight className="size-3.5" aria-hidden />
      </Button>
    </section>
  );
}

function PointList({
  points,
  tone,
}: {
  points: ReportPoint[];
  tone: keyof typeof TONES;
}) {
  const t = TONES[tone];
  return (
    <ul className="space-y-3">
      {points.map((p) => (
        <li
          key={p.headline}
          className={cn("rounded-xl border p-3", t.border, t.soft)}
        >
          <p className={cn("text-sm font-semibold", t.head)}>{p.headline}</p>
          <p className="mt-1 text-sm leading-relaxed">{p.detail}</p>
        </li>
      ))}
    </ul>
  );
}

/** Answers to work on: question, what was missing, and a button to the better answer. */
function MissedTable({
  writing,
  onOpen,
}: {
  writing: (typeof SAMPLE_WRITING)["ai"];
  onOpen: (m: Modal) => void;
}) {
  if (writing.missed.length === 0) return null;
  return (
    <section className="rounded-2xl border border-rose-200 bg-card p-4 md:p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-rose-700">
        <span className="flex size-7 items-center justify-center rounded-lg bg-rose-50">
          <TriangleAlert className="size-4 text-rose-600" aria-hidden />
        </span>
        Answers to work on
        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold">
          {writing.missed.length}
        </span>
      </h2>
      <div className="mt-3 overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="border-b bg-white/40 text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Question</th>
              <th className="px-3 py-2 font-medium">What was missing</th>
              <th className="w-36 px-3 py-2 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {writing.missed.map((m, i) => {
              const better = writing.betterAnswers.find(
                (b) => b.question === m.question,
              );
              return (
                <tr key={m.question} className="align-middle">
                  <td className="px-3 py-2.5 text-xs text-muted-foreground tabular-nums">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2.5">{m.question}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                      {m.headline}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Button
                      variant="outline"
                      className="border-primary/30 text-primary hover:bg-primary/5"
                      onClick={() =>
                        onOpen({
                          title: "A better way to answer",
                          description: m.question,
                          body: (
                            <div className="space-y-3">
                              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                                <p className="text-xs font-semibold text-rose-700">
                                  What was missing
                                </p>
                                <p className="mt-1 text-sm leading-relaxed">
                                  {m.note}
                                </p>
                              </div>
                              {better && (
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                                  <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                                    <Lightbulb
                                      className="size-3.5"
                                      aria-hidden
                                    />
                                    Try answering like this
                                  </p>
                                  <p className="mt-1 text-sm leading-relaxed">
                                    {better.answer}
                                  </p>
                                </div>
                              )}
                            </div>
                          ),
                        })
                      }
                    >
                      <Lightbulb className="size-4" aria-hidden />
                      Better answer
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ActionPlan({ points }: { points: ReportPoint[] }) {
  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-sky-700">
        <span className="flex size-7 items-center justify-center rounded-lg bg-sky-50">
          <ListChecks className="size-4 text-sky-600" aria-hidden />
        </span>
        Your action plan
      </h2>
      <ol className="mt-3 grid gap-3 sm:grid-cols-3">
        {points.map((p, i) => (
          <li
            key={p.headline}
            className="relative rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-3"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-sky-600 text-xs font-semibold text-white">
              {i + 1}
            </span>
            <p className="mt-2 text-sm font-semibold">{p.headline}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {p.detail}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Conversation() {
  return (
    <ol className="space-y-2.5">
      {SAMPLE_CHAT.map((m) => (
        <li
          key={m.id}
          className={cn("flex", m.from === "you" && "justify-end")}
        >
          <p
            className={cn(
              "max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
              m.from === "ai"
                ? "rounded-tl-sm border bg-card"
                : "rounded-tr-sm bg-gradient-to-br from-primary to-violet-600 text-white",
            )}
          >
            <span className="sr-only">
              {m.from === "ai" ? "Interviewer: " : "You: "}
            </span>
            {m.text}
          </p>
        </li>
      ))}
    </ol>
  );
}

function AwaitingReport() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex items-start gap-3 bg-gradient-to-r from-amber-50 to-transparent p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
          <Hourglass className="size-5 text-amber-700" aria-hidden />
        </span>
        <div className="text-sm">
          <p className="font-semibold">
            Your interviewer hasn&apos;t sent the evaluation yet
          </p>
          <p className="mt-1 text-muted-foreground">
            Interviewers have 48 hours after the interview to send it. If it
            hasn&apos;t arrived after 40 hours, you can send them a reminder.
          </p>
          <Button
            variant="outline"
            className="mt-3 border-amber-300 text-amber-800 hover:bg-amber-50"
            onClick={() =>
              toast.success(
                "Sample: reminder sent",
                "Your interviewer gets an email and a notification.",
              )
            }
          >
            <Bell className="size-4" aria-hidden />
            Remind my interviewer
          </Button>
        </div>
      </div>
    </div>
  );
}
