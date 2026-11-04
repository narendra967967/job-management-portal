"use client";

// Ask: chat with the knowledge-base agent. Answers come only from published
// articles and live How-to guides, listed as sources; when nothing fits, the agent says so and the
// question goes to Unanswered. ?c=<id> reopens a past conversation.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Bot, FileText, Loader2, Plus, SendHorizontal, SearchX } from "lucide-react";
import { Card } from "@/components/admin/ui/card";
import { Button, buttonVariants } from "@/components/admin/ui/button";
import { toast } from "@/components/admin/ui/toast";
import { askKbAction } from "@/actions/admin-kb";
import { KB_QUESTION_MAX, type KbConversation, type KbMessage } from "@/lib/kb-model";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "Why was a lead closed on its own?",
  "Nobody can sign in, what do I do?",
  "How do I add a new job site?",
];

export function KbAsk({ conversation }: { conversation: KbConversation | null }) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const messages = useMemo(() => conversation?.messages ?? [], [conversation]);
  // Once the refreshed conversation includes the question, stop showing it as pending.
  useEffect(() => {
    if (pending && messages.some((m) => m.role === "user" && m.text === pending)) setPending(null);
  }, [messages, pending]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pending]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    setDraft("");
    setPending(q);
    const res = await askKbAction(conversation?.id ?? null, q);
    if (!res.ok) {
      setPending(null);
      setDraft(q);
      toast.error(res.error);
      return;
    }
    if (res.conversationId !== conversation?.id) {
      router.replace(`/jmp-admin/knowledge-base?c=${res.conversationId}`, { scroll: false });
    } else {
      router.refresh();
    }
    inputRef.current?.focus();
  }

  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-sm font-semibold">{conversation ? conversation.title : "New conversation"}</h2>
        {conversation && (
          <Link href="/jmp-admin/knowledge-base" className={cn(buttonVariants({ variant: "outline" }), "shrink-0 px-3")}>
            <Plus className="size-4" aria-hidden />
            New chat
          </Link>
        )}
      </div>

      <div className="flex-1 space-y-4">
        {!conversation && !pending && (
          <Card className="space-y-4 p-5 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bot className="size-5" aria-hidden />
            </span>
            <p className="text-sm font-medium">Ask anything the knowledge base covers</p>
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLES.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => send(e)}
                  className="min-h-11 rounded-full border bg-white/60 px-3 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground sm:min-h-9"
                >
                  {e}
                </button>
              ))}
            </div>
          </Card>
        )}
        {messages.map((m) => (
          <Message key={m.id} m={m} question={questionBefore(messages, m)} />
        ))}
        {pending && (
          <>
            <Message m={{ id: "pending-q", role: "user", text: pending, at: "" }} />
            <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Looking through the articles…
            </div>
          </>
        )}
        <div ref={endRef} />
      </div>

      {/* Stays at the bottom of the scrolling page. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="sticky bottom-0 -mx-1 mt-4 bg-gradient-to-t from-white/90 via-white/80 to-transparent px-1 pt-3 pb-1"
      >
        <Card className="flex items-end gap-2 p-2">
          <textarea
            ref={inputRef}
            value={draft}
            maxLength={KB_QUESTION_MAX}
            rows={1}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
            placeholder="Ask a question"
            aria-label="Your question"
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-base outline-none placeholder:text-muted-foreground md:text-sm"
          />
          <Button type="submit" size="icon-lg" aria-label="Send" disabled={!draft.trim() || !!pending}>
            <SendHorizontal className="size-4" aria-hidden />
          </Button>
        </Card>
        {draft.length > KB_QUESTION_MAX - 50 && (
          <p className="mt-1 px-1 text-right text-[11px] text-muted-foreground tabular-nums">
            {draft.length}/{KB_QUESTION_MAX}
          </p>
        )}
      </form>
    </div>
  );
}

function questionBefore(messages: KbMessage[], m: KbMessage): string | undefined {
  const i = messages.indexOf(m);
  for (let j = i - 1; j >= 0; j--) if (messages[j].role === "user") return messages[j].text;
  return undefined;
}

function Message({ m, question }: { m: KbMessage; question?: string }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm whitespace-pre-wrap text-primary-foreground">
          {m.text}
        </p>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          m.unanswered ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary",
        )}
        aria-hidden
      >
        {m.unanswered ? <SearchX className="size-4" /> : <Bot className="size-4" />}
      </span>
      <div className="min-w-0 max-w-[85%] space-y-2">
        <Card className="rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm leading-relaxed">{m.text}</Card>
        {m.sources && m.sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Sources</span>
            {m.sources.map((s) => (
              <Link
                key={s.id}
                href={s.href ?? `/jmp-admin/knowledge-base/articles/${s.id}`}
                className="inline-flex min-h-11 items-center gap-1 rounded-md border bg-white/60 px-2.5 text-xs hover:border-primary/40 hover:text-primary"
              >
                {s.kind === "guide" ? <BookOpen className="size-3" aria-hidden /> : <FileText className="size-3" aria-hidden />}
                {s.title}
              </Link>
            ))}
          </div>
        )}
        {m.unanswered && (
          <Link
            href={`/jmp-admin/knowledge-base/articles/new${question ? `?title=${encodeURIComponent(question)}` : ""}`}
            className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Plus className="size-3.5" aria-hidden />
            Write an article for this
          </Link>
        )}
      </div>
    </div>
  );
}
