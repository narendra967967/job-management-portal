"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  FileText,
  LifeBuoy,
  Plus,
  SendHorizontal,
  Square,
  WifiOff,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { answerInterviewAction, endInterviewAction, interviewHeartbeatAction, startInterviewAction } from "@/actions/mock-interviews";
import {
  InterviewPanel,
  InterviewPanelCompact,
  QuestionTrack,
  mmss,
  timerTone,
  type PanelData,
} from "@/components/mock-interviews/interview-panel";
import type { SessionData } from "@/lib/mock-interviews/data";
import { plannedQuestions, type ChatMessage } from "@/lib/mock-interviews/model";
import { useProfile } from "@/lib/mock-store";
import { cn } from "@/lib/utils";
import { scrollIntoMain } from "@/components/mock-interviews/scroll-into-main";
import {
  DictationButton,
  useDictation,
} from "@/components/mock-interviews/dictation";

// The AI interview (spec D10, D13): the conversation in the middle, a live panel
// beside it (time, progress, topics, pace, what's scored, a tip), and an answer
// box that can be typed or spoken into. The interviewer, the clock and the
// wrap-up all run on the server (lib/mock-interviews/engine.ts).

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

export function InterviewChat({ session }: { session: SessionData }) {
  const router = useRouter();
  const profile = useProfile();
  const { durationMin, settings } = session;
  const totalQuestions = session.plan.length || plannedQuestions(durationMin, settings.minutesPerQuestion);
  const [messages, setMessages] = useState<ChatMessage[]>(session.messages);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const { confirm, dialog } = useConfirm();
  const [state, setState] = useState<ChatState>(session.phase);
  const interviewSeconds = durationMin * 60;
  const wrapSeconds = settings.wrapUpMinutes * 60;
  // Seconds on the clock. The server keeps the real count (connected time only)
  // and every heartbeat corrects this; in between it ticks here.
  const [active, setActive] = useState(session.activeSeconds);
  const secondsLeft =
    state === "wrapup" ? Math.max(0, interviewSeconds + wrapSeconds - active) : Math.max(0, interviewSeconds - active);
  const endRef = useRef<HTMLDivElement>(null);
  const ended = state === "ended";
  const dictation = useDictation({
    text: draft,
    onText: setDraft,
    max: MAX_ANSWER,
  });

  // The clock only runs while connected (owner, November 17, 2026). Offline,
  // it stops here and no heartbeats go out, so the server doesn't count the
  // time either; a closed tab or crashed browser stops the heartbeats too.
  const [offline, setOffline] = useState(false);
  // Time away is one allowance for the whole interview (D13f). The server keeps
  // the real figure; while offline this counts it down so the candidate sees it.
  const [awayLeft, setAwayLeft] = useState(session.awayLeftSeconds);
  const [offlineFor, setOfflineFor] = useState(0);
  useEffect(() => {
    if (!offline) return;
    const since = Date.now();
    const t = setInterval(() => setOfflineFor(Math.floor((Date.now() - since) / 1000)), 1000);
    return () => {
      clearInterval(t);
      setOfflineFor(0);
    };
  }, [offline]);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Coming back to an interrupted interview resumes it.
  useEffect(() => {
    if (session.status !== "interrupted") return;
    startInterviewAction(session.id)
      .then((r) => {
        if (!r.ok) toast.error("Couldn't resume", r.error);
        router.refresh();
      })
      .catch(() => toast.error("Couldn't resume", "Check your connection and reload the page."));
  }, [session.id, session.status, router]);

  useEffect(() => {
    if (ended || offline) return;
    const t = setInterval(() => setActive((a) => a + 1), 1000);
    return () => clearInterval(t);
  }, [ended, offline]);

  // Heartbeat: every 15 seconds while connected.
  useEffect(() => {
    if (ended || offline) return;
    let live = true;
    const beat = async () => {
      try {
        const r = await interviewHeartbeatAction(session.id);
        if (!live || !r) return;
        setActive(r.activeSeconds);
        setAwayLeft(r.awayLeftSeconds);
        setState(r.phase);
      } catch {
        /* the next beat tries again */
      }
    };
    void beat();
    const t = setInterval(beat, 15_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [ended, offline, session.id]);

  useEffect(() => {
    scrollIntoMain(endRef.current, "end");
  }, [messages.length, thinking, state]);

  const questionNo = messages.reduce(
    (n, m) => Math.max(n, m.questionNo ?? 0),
    0,
  );
  const elapsed = active;
  const yourAnswers = messages.filter((m) => m.from === "you");
  const totalWords = yourAnswers.reduce((n, m) => n + words(m.text), 0);
  const waitingForAnswer = messages.at(-1)?.from === "ai" && messages.at(-1)?.kind !== "closing";
  // How it ended: with no answers there's nothing to score; a problem on our side needs support.
  const noAnswers = session.noAnswers || (ended && yourAnswers.length === 0);
  const problem = session.status === "failed" && !noAnswers;

  const panel: PanelData = useMemo(
    () => ({
      phase: state,
      secondsLeft,
      totalSeconds: state === "wrapup" ? wrapSeconds : interviewSeconds,
      elapsed: Math.min(elapsed, interviewSeconds + wrapSeconds),
      questionNo,
      totalQuestions,
      minutesPerQuestion: settings.minutesPerQuestion,
      paceGraceMinutes: settings.paceGraceMinutes,
      topics: session.topics,
      answers: yourAnswers.length,
      avgWords: yourAnswers.length
        ? Math.round(totalWords / yourAnswers.length)
        : 0,
      tip: session.plan[Math.max(1, questionNo) - 1]?.tip ?? "Lead with the outcome, then explain how you got there.",
    }),
    [
      state,
      secondsLeft,
      wrapSeconds,
      interviewSeconds,
      elapsed,
      questionNo,
      totalQuestions,
      settings,
      session.topics,
      session.plan,
      yourAnswers.length,
      totalWords,
    ],
  );

  async function send() {
    const text = draft.trim();
    if (!text || thinking || ended || !waitingForAnswer) return;
    dictation.stop();
    const tempId = `pending-${Date.now()}`;
    setMessages((m) => [...m, { id: tempId, from: "you", text, at: elapsed }]);
    setDraft("");
    setThinking(true);
    try {
      const r = await answerInterviewAction(session.id, text);
      if (!r.ok) {
        // Put the answer back so nothing typed is lost.
        setMessages((m) => m.filter((x) => x.id !== tempId));
        setDraft(text);
        toast.error("Not sent", r.error);
        return;
      }
      setMessages((m) => [...m.filter((x) => x.id !== tempId), ...r.messages]);
      setActive(r.state.activeSeconds);
      setAwayLeft(r.state.awayLeftSeconds);
      setState(r.state.phase);
    } catch {
      setMessages((m) => m.filter((x) => x.id !== tempId));
      setDraft(text);
      toast.error("Not sent", "Check your connection and try again. Your answer is still in the box.");
    } finally {
      setThinking(false);
    }
  }

  async function endNow() {
    const ok = await confirm({
      title: "End the interview now?",
      description:
        "Questions you haven't answered won't be scored. You'll get a report on what you did answer.",
      confirmLabel: "End interview",
      destructive: true,
    });
    if (!ok) return;
    const r = await endInterviewAction(session.id).catch(() => null);
    if (!r?.ok) {
      toast.error("Couldn't end the interview", r?.error ?? "Check your connection and try again.");
      return;
    }
    setState("ended");
    router.refresh();
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
                        {session.role}
                      </p>
                      <StatusPill state={state} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                      <Chip>{session.category}</Chip>
                      <Chip>{session.difficulty}</Chip>
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

          {offline && !ended && (
            <p
              className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900"
              role="alert"
            >
              <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <span className="font-semibold">You&apos;re offline. The clock is paused.</span>{" "}
                It picks up from {mmss(secondsLeft)} as soon as you&apos;re back, and your answers so far are kept. You have about{" "}
                <span className="font-semibold tabular-nums">{mmss(Math.max(0, awayLeft - offlineFor))}</span> of time away left
                for this interview. After that, it ends with what you&apos;ve answered.
              </span>
            </p>
          )}

          {state === "wrapup" && (
            <p
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-900"
              role="status"
            >
              Time&apos;s up. The interviewer is finishing the last questions
              and will end within {settings.wrapUpMinutes} minutes.
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
                      ) : m.kind === "closing" ? null : (
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
                  {noAnswers
                    ? "You ended it before answering a question, so there's nothing to score this time and no report. Book another whenever you're ready."
                    : problem
                      ? "Something went wrong on our side and the interview had to stop. Contact support and we'll look into it."
                      : "Your report is being written now. It usually takes under a minute, and it'll be in Interview history too."}
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
                  href={noAnswers ? "/mock-interviews/ai/new" : problem ? "/support" : `/mock-interviews/report/${session.id}`}
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "bg-gradient-to-r from-primary to-violet-600 text-white hover:opacity-90",
                  )}
                >
                  {noAnswers ? <Plus className="size-4" aria-hidden /> : problem ? <LifeBuoy className="size-4" aria-hidden /> : <FileText className="size-4" aria-hidden />}
                  {noAnswers ? "Book another interview" : problem ? "Contact support" : "See your report"}
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
                    void send();
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
                disabled={thinking || !waitingForAnswer}
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
                  <DictationButton dictation={dictation} disabled={thinking || !waitingForAnswer} />
                  <Button
                    onClick={send}
                    disabled={!draft.trim() || thinking || !waitingForAnswer}
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
