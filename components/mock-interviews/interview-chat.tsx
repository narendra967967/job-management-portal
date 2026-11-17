"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Clock, Loader2, SendHorizontal, Square, TimerReset } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { SampleBanner } from "@/components/mock-interviews/sample-banner";
import { SAMPLE_CHAT, SAMPLE_FOLLOW_UPS, SAMPLE_SETTINGS, type ChatMessage } from "@/lib/mock-interviews/sample-data";
import { plannedQuestions } from "@/lib/mock-interviews/model";
import { cn } from "@/lib/utils";
import { scrollIntoMain } from "@/components/mock-interviews/scroll-into-main";

// The AI interview (spec D10, D13). R1.2: a sample conversation; answering adds
// a canned follow-up. R1.5 connects the real interviewer, pacing and wrap-up.

export type ChatState = "live" | "wrapup" | "ended";

const MAX_ANSWER = 4000;

export function InterviewChat({ sessionId, state }: { sessionId: string; state: ChatState }) {
  const router = useRouter();
  const durationMin = 30;
  const totalQuestions = plannedQuestions(durationMin, SAMPLE_SETTINGS.minutesPerQuestion);
  const [messages, setMessages] = useState<ChatMessage[]>(SAMPLE_CHAT);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const { confirm, dialog } = useConfirm();
  const [followUp, setFollowUp] = useState(0);
  // Seconds left: of the interview while live, of the wrap-up extension after.
  const [secondsLeft, setSecondsLeft] = useState(state === "wrapup" ? SAMPLE_SETTINGS.wrapUpMinutes * 60 - 31 : 18 * 60 + 42);
  const endRef = useRef<HTMLDivElement>(null);
  const ended = state === "ended";

  useEffect(() => {
    if (ended) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [ended]);

  useEffect(() => {
    scrollIntoMain(endRef.current, "end");
  }, [messages.length, thinking, state]);

  const questionNo = messages.reduce((n, m) => Math.max(n, m.questionNo ?? 0), 0);
  const base = `/mock-interviews/ai/session/${sessionId}`;

  function send() {
    const text = draft.trim();
    if (!text || thinking || ended) return;
    setMessages((m) => [...m, { id: `y${m.length}`, from: "you", text }]);
    setDraft("");
    setThinking(true);
    // SAMPLE: a canned follow-up instead of the AI.
    setTimeout(() => {
      const next = SAMPLE_FOLLOW_UPS[followUp % SAMPLE_FOLLOW_UPS.length];
      const opensQuestion = next.startsWith("Thanks. Next question");
      setMessages((m) => [...m, { id: `a${m.length}`, from: "ai", text: next, questionNo: opensQuestion ? questionNo + 1 : undefined }]);
      setFollowUp((f) => f + 1);
      setThinking(false);
    }, 1200);
  }

  async function endNow() {
    const ok = await confirm({
      title: "End the interview now?",
      description: "Questions you haven't answered won't be scored. You'll get a report on what you did answer.",
      confirmLabel: "End interview",
    });
    if (ok) router.push(`${base}?state=ended`);
  }

  const mmss = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      <SampleBanner
        previews={[
          { label: "In progress", href: base, active: state === "live" },
          { label: "Wrapping up", href: `${base}?state=wrapup`, active: state === "wrapup" },
          { label: "Finished", href: `${base}?state=ended`, active: state === "ended" },
        ]}
      />

      {/* Header: what this is, progress and time. Sticks to the top while scrolling. */}
      <div className="sticky top-0 z-10 -mx-1 rounded-xl border bg-card/95 px-3 py-2.5 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">Technical Project Manager</p>
            <p className="truncate text-xs text-muted-foreground">Project management · Medium · {durationMin} min</p>
          </div>
          {!ended && (
            <div
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold tabular-nums",
                state === "wrapup" ? "bg-amber-100 text-amber-900" : "bg-muted",
              )}
              aria-label={state === "wrapup" ? `Wrap-up time left ${mmss}` : `Time left ${mmss}`}
            >
              {state === "wrapup" ? <TimerReset className="size-4" aria-hidden /> : <Clock className="size-4" aria-hidden />}
              {mmss}
            </div>
          )}
          {!ended && (
            <Button variant="outline" onClick={() => void endNow()} className="shrink-0">
              <Square className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">End interview</span>
              <span className="sm:hidden">End</span>
            </Button>
          )}
        </div>
        {!ended && (
          <div className="mt-2">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>
                Question {Math.min(questionNo, totalQuestions)} of about {totalQuestions}
              </span>
              <span>{state === "wrapup" ? "Wrapping up" : "In progress"}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.min(100, (questionNo / totalQuestions) * 100)}%` }} />
            </div>
          </div>
        )}
      </div>

      {state === "wrapup" && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
          Time&apos;s up. The interviewer is finishing the last questions and will end within {SAMPLE_SETTINGS.wrapUpMinutes} minutes.
        </p>
      )}

      <ol className="space-y-3" aria-label="Conversation">
        {messages.map((m) => (
          <li key={m.id} className={cn("flex gap-2", m.from === "you" && "justify-end")}>
            {m.from === "ai" && (
              <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bot className="size-4" aria-hidden />
              </span>
            )}
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                m.from === "ai" ? "rounded-tl-sm border bg-card" : "rounded-tr-sm bg-primary text-primary-foreground",
              )}
            >
              {m.questionNo && <p className="mb-1 text-[11px] font-semibold text-primary">Question {m.questionNo}</p>}
              <span className="sr-only">{m.from === "ai" ? "Interviewer: " : "You: "}</span>
              {m.text}
            </div>
          </li>
        ))}
        {thinking && (
          <li className="flex gap-2" aria-live="polite">
            <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bot className="size-4" aria-hidden />
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-2xl rounded-tl-sm border bg-card px-3.5 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Thinking about your answer
            </span>
          </li>
        )}
      </ol>
      <div ref={endRef} />

      {ended ? (
        <div className="rounded-xl border bg-card p-5 text-center">
          <p className="font-medium">That&apos;s the end of the interview</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Your report is being written now. It usually takes under a minute, and it&apos;ll be in Interview history too.
          </p>
          <Link href="/mock-interviews/report/ai-8" className={cn(buttonVariants({ size: "lg" }), "mt-4")}>
            See your report
          </Link>
        </div>
      ) : (
        <div className="sticky bottom-0 z-10 -mx-1 rounded-xl border bg-card/95 p-2 shadow-sm backdrop-blur">
          <Textarea
            value={draft}
            maxLength={MAX_ANSWER}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends on a keyboard; Shift+Enter adds a line. Phones use the button.
              if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(min-width: 768px)").matches) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type your answer"
            rows={3}
            aria-label="Your answer"
            className="resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            disabled={thinking}
          />
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-[11px] text-muted-foreground">
              <span className="hidden md:inline">Enter to send, Shift+Enter for a new line · </span>
              {draft.length}/{MAX_ANSWER}
            </span>
            <Button onClick={send} disabled={!draft.trim() || thinking}>
              <SendHorizontal className="size-4" aria-hidden />
              Send
            </Button>
          </div>
        </div>
      )}

      {dialog}
    </div>
  );
}
