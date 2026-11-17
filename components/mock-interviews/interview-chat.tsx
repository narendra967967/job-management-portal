"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  FileText,
  SendHorizontal,
  Square,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { SampleBanner } from "@/components/mock-interviews/sample-banner";
import {
  InterviewPanel,
  InterviewPanelCompact,
  QuestionTrack,
  mmss,
  timerTone,
  type PanelData,
} from "@/components/mock-interviews/interview-panel";
import {
  SAMPLE_CHAT,
  SAMPLE_FOLLOW_UPS,
  SAMPLE_SESSION,
  SAMPLE_SETTINGS,
  SAMPLE_TIPS,
  type ChatMessage,
} from "@/lib/mock-interviews/sample-data";
import { plannedQuestions } from "@/lib/mock-interviews/model";
import { useProfile } from "@/lib/mock-store";
import { cn } from "@/lib/utils";
import { scrollIntoMain } from "@/components/mock-interviews/scroll-into-main";
import {
  DictationButton,
  useDictation,
} from "@/components/mock-interviews/dictation";

// The AI interview (spec D10, D13): the conversation in the middle, a live panel
// beside it (time, progress, topics, pace, what's scored, a tip), and an answer
// box that can be typed or spoken into. R1.2: a sample conversation; answering
// adds a canned follow-up. R1.5 connects the real interviewer, pacing and wrap-up.

export type ChatState = "live" | "wrapup" | "ended";

const MAX_ANSWER = 4000;
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

/** Live feedback on the answer being written. */
function lengthHint(n: number) {
  if (n === 0) return null;
  if (n < 25)
    return {
      label: "Short. Add an example or a result.",
      tone: "text-amber-700",
      bar: "bg-amber-400",
      pct: (n / 25) * 33,
    };
  if (n <= 180)
    return {
      label: "Good length",
      tone: "text-emerald-700",
      bar: "bg-emerald-500",
      pct: 33 + ((n - 25) / 155) * 50,
    };
  return {
    label: "Long. Get to the point sooner.",
    tone: "text-amber-700",
    bar: "bg-amber-400",
    pct: 100,
  };
}

export function InterviewChat({
  sessionId,
  state,
}: {
  sessionId: string;
  state: ChatState;
}) {
  const router = useRouter();
  const profile = useProfile();
  const { durationMin } = SAMPLE_SESSION;
  const totalQuestions = plannedQuestions(
    durationMin,
    SAMPLE_SETTINGS.minutesPerQuestion,
  );
  const [messages, setMessages] = useState<ChatMessage[]>(SAMPLE_CHAT);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const { confirm, dialog } = useConfirm();
  const [followUp, setFollowUp] = useState(0);
  const interviewSeconds = durationMin * 60;
  const wrapSeconds = SAMPLE_SETTINGS.wrapUpMinutes * 60;
  // Seconds left: of the interview while live, of the wrap-up extension after.
  const [secondsLeft, setSecondsLeft] = useState(
    state === "wrapup" ? wrapSeconds - 31 : 26 * 60 + 10,
  );
  const endRef = useRef<HTMLDivElement>(null);
  const ended = state === "ended";
  const dictation = useDictation({
    text: draft,
    onText: setDraft,
    max: MAX_ANSWER,
  });

  useEffect(() => {
    if (ended) return;
    const t = setInterval(
      () => setSecondsLeft((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearInterval(t);
  }, [ended]);

  useEffect(() => {
    scrollIntoMain(endRef.current, "end");
  }, [messages.length, thinking, state]);

  const questionNo = messages.reduce(
    (n, m) => Math.max(n, m.questionNo ?? 0),
    0,
  );
  const base = `/mock-interviews/ai/session/${sessionId}`;
  const elapsed =
    state === "wrapup"
      ? interviewSeconds + (wrapSeconds - secondsLeft)
      : interviewSeconds - secondsLeft;
  const yourAnswers = messages.filter((m) => m.from === "you");
  const totalWords = yourAnswers.reduce((n, m) => n + words(m.text), 0);

  const panel: PanelData = useMemo(
    () => ({
      phase: state,
      secondsLeft,
      totalSeconds: state === "wrapup" ? wrapSeconds : interviewSeconds,
      elapsed,
      questionNo,
      totalQuestions,
      minutesPerQuestion: SAMPLE_SETTINGS.minutesPerQuestion,
      paceGraceMinutes: SAMPLE_SETTINGS.paceGraceMinutes,
      topics: SAMPLE_SESSION.topics,
      answers: yourAnswers.length,
      avgWords: yourAnswers.length
        ? Math.round(totalWords / yourAnswers.length)
        : 0,
      tip: SAMPLE_TIPS[(Math.max(1, questionNo) - 1) % SAMPLE_TIPS.length],
    }),
    [
      state,
      secondsLeft,
      wrapSeconds,
      interviewSeconds,
      elapsed,
      questionNo,
      totalQuestions,
      yourAnswers.length,
      totalWords,
    ],
  );

  function send() {
    const text = draft.trim();
    if (!text || thinking || ended) return;
    dictation.stop();
    setMessages((m) => [
      ...m,
      { id: `y${m.length}`, from: "you", text, at: elapsed },
    ]);
    setDraft("");
    setThinking(true);
    // SAMPLE: a canned follow-up instead of the AI.
    setTimeout(() => {
      const next = SAMPLE_FOLLOW_UPS[followUp % SAMPLE_FOLLOW_UPS.length];
      const opensQuestion = next.startsWith("Thanks. Next question");
      setMessages((m) => [
        ...m,
        {
          id: `a${m.length}`,
          from: "ai",
          text: next,
          at: elapsed + 2,
          questionNo: opensQuestion ? questionNo + 1 : undefined,
        },
      ]);
      setFollowUp((f) => f + 1);
      setThinking(false);
    }, 1400);
  }

  async function endNow() {
    const ok = await confirm({
      title: "End the interview now?",
      description:
        "Questions you haven't answered won't be scored. You'll get a report on what you did answer.",
      confirmLabel: "End interview",
      destructive: true,
    });
    if (ok) router.push(`${base}?state=ended`);
  }

  const tone = timerTone(state, secondsLeft);
  const hint = lengthHint(words(draft));
  const initials = (profile.name || "You")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto max-w-6xl space-y-3">
      <SampleBanner
        previews={[
          { label: "In progress", href: base, active: state === "live" },
          {
            label: "Wrapping up",
            href: `${base}?state=wrapup`,
            active: state === "wrapup",
          },
          {
            label: "Finished",
            href: `${base}?state=ended`,
            active: state === "ended",
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        {/* ---------------- Conversation column ---------------- */}
        <div className="flex min-w-0 flex-col gap-3">
          {/* Header: sticks to the top while scrolling. The frosted strip (negative top
              plus matching padding) covers <main>'s top padding, so messages don't show
              through the gap above it. */}
          <div className="sticky -top-4 z-10 -mx-1 bg-white/30 pt-4 backdrop-blur-md md:-top-6 md:pt-6">
            <div className="overflow-hidden rounded-2xl border bg-card/95 shadow-sm">
              <div className="bg-gradient-to-r from-primary/12 via-violet-500/8 to-transparent px-3.5 py-3">
                <div className="flex items-center gap-3">
                  <span className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-violet-600 text-white shadow-sm sm:flex">
                    <Bot className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="min-w-0 leading-snug font-semibold sm:truncate">
                        {SAMPLE_SESSION.role}
                      </p>
                      <StatusPill state={state} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                      <Chip>{SAMPLE_SESSION.category}</Chip>
                      <Chip>{SAMPLE_SESSION.difficulty}</Chip>
                      <Chip>{durationMin} min</Chip>
                    </div>
                  </div>
                  {!ended && (
                    <>
                      {/* The ring lives in the side panel on wide screens; phones get this chip. */}
                      <span
                        className={cn(
                          "shrink-0 rounded-lg border px-2.5 py-1.5 text-sm font-semibold tabular-nums lg:hidden",
                          tone.chip,
                        )}
                        aria-label={
                          state === "wrapup"
                            ? `Wrap-up time left ${mmss(secondsLeft)}`
                            : `Time left ${mmss(secondsLeft)}`
                        }
                      >
                        {mmss(secondsLeft)}
                      </span>
                      <Button
                        variant="outline"
                        onClick={() => void endNow()}
                        className="shrink-0 border-rose-200 bg-white/70 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                      >
                        <Square className="size-3.5" aria-hidden />
                        <span className="hidden sm:inline">End interview</span>
                        <span className="sm:hidden">End</span>
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {!ended && (
                <div className="border-t px-3.5 py-2 lg:hidden">
                  <QuestionTrack d={panel} />
                </div>
              )}
            </div>
          </div>

          <InterviewPanelCompact d={panel} />

          {state === "wrapup" && (
            <p
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-900"
              role="status"
            >
              Time&apos;s up. The interviewer is finishing the last questions
              and will end within {SAMPLE_SETTINGS.wrapUpMinutes} minutes.
            </p>
          )}

          <ol className="space-y-4" aria-label="Conversation">
            {messages.map((m) =>
              m.from === "ai" ? (
                <li key={m.id} className="flex gap-2.5">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-violet-600 text-white shadow-sm">
                    <Bot className="size-4" aria-hidden />
                  </span>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl rounded-tl-sm border bg-card px-3.5 py-2.5 shadow-sm",
                      m.questionNo && "border-l-4 border-l-primary",
                    )}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      {m.questionNo ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          Question {m.questionNo}
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                          Follow-up
                        </span>
                      )}
                      {m.at !== undefined && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {mmss(m.at)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed">
                      <span className="sr-only">Interviewer: </span>
                      {m.text}
                    </p>
                  </div>
                </li>
              ) : (
                <li key={m.id} className="flex justify-end gap-2.5">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-primary to-violet-600 px-3.5 py-2.5 text-white shadow-sm">
                    <p className="text-sm leading-relaxed">
                      <span className="sr-only">You: </span>
                      {m.text}
                    </p>
                    <p className="mt-1 text-right text-[10px] text-white/75 tabular-nums">
                      {words(m.text)} words
                      {m.at !== undefined ? ` · ${mmss(m.at)}` : ""}
                    </p>
                  </div>
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-700">
                    {initials}
                  </span>
                </li>
              ),
            )}
            {thinking && (
              <li className="flex gap-2.5" aria-live="polite">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-violet-600 text-white shadow-sm">
                  <Bot className="size-4" aria-hidden />
                </span>
                <span className="inline-flex items-center gap-2 rounded-2xl rounded-tl-sm border bg-card px-3.5 py-3 text-sm text-muted-foreground shadow-sm">
                  <span className="flex gap-1" aria-hidden>
                    {[0, 150, 300].map((d) => (
                      <span
                        key={d}
                        className="size-1.5 animate-bounce rounded-full bg-primary/60 motion-reduce:animate-none"
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </span>
                  Reading your answer
                </span>
              </li>
            )}
          </ol>
          <div ref={endRef} />

          {ended ? (
            <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="bg-gradient-to-r from-emerald-500/12 via-primary/8 to-transparent p-5 text-center">
                <CheckCircle2
                  className="mx-auto size-10 text-emerald-600"
                  aria-hidden
                />
                <p className="mt-2 text-lg font-semibold">
                  That&apos;s the end of the interview
                </p>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  Your report is being written now. It usually takes under a
                  minute, and it&apos;ll be in Interview history too.
                </p>
              </div>
              <dl className="grid grid-cols-3 divide-x border-t text-center">
                {[
                  ["Questions", String(questionNo)],
                  ["Your answers", String(yourAnswers.length)],
                  ["Words", totalWords.toLocaleString("en-US")],
                ].map(([k, v]) => (
                  <div key={k} className="p-3">
                    <dt className="text-[11px] text-muted-foreground">{k}</dt>
                    <dd className="text-lg font-semibold tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap justify-center gap-2 border-t p-4">
                <Link
                  href="/mock-interviews/report/ai-8"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "bg-gradient-to-r from-primary to-violet-600 text-white hover:opacity-90",
                  )}
                >
                  <FileText className="size-4" aria-hidden />
                  See your report
                </Link>
                <Link
                  href="/mock-interviews/ai"
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                >
                  <ArrowLeft className="size-4" aria-hidden />
                  AI mock interviews
                </Link>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "sticky bottom-0 z-10 -mx-1 rounded-2xl border bg-card/95 p-2 shadow-md backdrop-blur transition-colors",
                dictation.listening
                  ? "border-rose-300 ring-2 ring-rose-200"
                  : "focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15",
              )}
            >
              <Textarea
                value={draft}
                maxLength={MAX_ANSWER}
                onChange={(e) => setDraft(e.target.value)}
                // Editing by hand turns the mic off, so speech and typing never fight.
                onPointerDown={() => dictation.listening && dictation.stop()}
                onKeyDown={(e) => {
                  if (
                    dictation.listening &&
                    !["Shift", "Control", "Alt", "Meta"].includes(e.key)
                  )
                    dictation.stop();
                  // Enter sends on a keyboard; Shift+Enter adds a line. Phones use the button.
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    window.matchMedia("(min-width: 768px)").matches
                  ) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={
                  dictation.listening
                    ? "Listening… speak your answer"
                    : dictation.supported
                      ? "Type or speak your answer"
                      : "Type your answer"
                }
                rows={3}
                aria-label="Your answer"
                className="resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                disabled={thinking}
              />
              {/* Answer length meter. */}
              <div className="px-2" aria-live="polite">
                <div
                  className="h-1 overflow-hidden rounded-full bg-muted"
                  aria-hidden
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-300",
                      hint?.bar ?? "bg-transparent",
                    )}
                    style={{ width: `${hint?.pct ?? 0}%` }}
                  />
                </div>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2 px-1">
                <span className="min-w-0 text-[11px] text-muted-foreground">
                  {dictation.listening ? (
                    <span className="font-medium text-rose-700" role="status">
                      Listening. Check the words, then press Send
                    </span>
                  ) : hint ? (
                    <span className={cn("font-medium", hint.tone)}>
                      {words(draft)} words · {hint.label}
                    </span>
                  ) : (
                    <span className="hidden md:inline">
                      Enter to send, Shift+Enter for a new line
                    </span>
                  )}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <DictationButton dictation={dictation} disabled={thinking} />
                  <Button
                    onClick={send}
                    disabled={!draft.trim() || thinking}
                    className="bg-gradient-to-r from-primary to-violet-600 text-white shadow-sm hover:opacity-90"
                  >
                    <SendHorizontal className="size-4" aria-hidden />
                    Send
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ---------------- Live panel (wide screens) ---------------- */}
        {/* Pinned while the conversation scrolls; scrolls itself if taller than the screen. */}
        <aside
          className="sticky top-0 hidden max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain rounded-xl lg:block"
          aria-label="Interview panel"
        >
          <InterviewPanel d={panel} />
        </aside>
      </div>

      {dialog}
    </div>
  );
}

function StatusPill({ state }: { state: ChatState }) {
  const s = {
    live: {
      label: "Live",
      cls: "border-emerald-200 bg-emerald-50 text-emerald-700",
      dot: "bg-emerald-500",
    },
    wrapup: {
      label: "Wrapping up",
      cls: "border-rose-200 bg-rose-50 text-rose-700",
      dot: "bg-rose-500",
    },
    ended: {
      label: "Finished",
      cls: "border-slate-200 bg-slate-50 text-slate-600",
      dot: "bg-slate-400",
    },
  }[state];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        s.cls,
      )}
    >
      <span className="relative flex size-1.5" aria-hidden>
        {state !== "ended" && (
          <span
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-75 motion-reduce:hidden",
              s.dot,
            )}
          />
        )}
        <span
          className={cn("relative inline-flex size-1.5 rounded-full", s.dot)}
        />
      </span>
      {s.label}
    </span>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border bg-white/70 px-1.5 py-0.5 text-muted-foreground">
      {children}
    </span>
  );
}
