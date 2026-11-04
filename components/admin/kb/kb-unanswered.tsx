"use client";

// Unanswered: questions the agent couldn't answer from the articles. Each one is
// a gap to fill: write an article, mark it covered, or dismiss it.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Plus, X } from "lucide-react";
import { Card } from "@/components/admin/ui/card";
import { Button, buttonVariants } from "@/components/admin/ui/button";
import { Badge } from "@/components/admin/ui/badge";
import { toast } from "@/components/admin/ui/toast";
import { setKbQuestionStatusAction } from "@/actions/admin-kb";
import { KB_QUESTION_STATUS_LABELS, type KbQuestion, type KbQuestionStatus } from "@/lib/kb-model";
import { useMounted } from "@/lib/use-mounted";
import { cn, formatDateTime } from "@/lib/utils";

const selectCls =
  "h-11 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none sm:h-9 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const BADGE: Record<KbQuestionStatus, "warning" | "success" | "neutral"> = {
  open: "warning",
  covered: "success",
  dismissed: "neutral",
};

export function KbUnanswered({ questions }: { questions: KbQuestion[] }) {
  const router = useRouter();
  const mounted = useMounted();
  const [fStatus, setFStatus] = useState<"all" | KbQuestionStatus>("open");
  const [busy, setBusy] = useState<string | null>(null);

  const list = useMemo(() => questions.filter((q) => fStatus === "all" || q.status === fStatus), [questions, fStatus]);

  async function setStatus(q: KbQuestion, status: KbQuestionStatus) {
    setBusy(q.id);
    const res = await setKbQuestionStatusAction(q.id, status);
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {list.length} {list.length === 1 ? "question" : "questions"}
        </p>
        <select className={selectCls} value={fStatus} onChange={(e) => setFStatus(e.target.value as typeof fStatus)} aria-label="Filter status">
          <option value="open">Open</option>
          <option value="covered">Covered</option>
          <option value="dismissed">Dismissed</option>
          <option value="all">All</option>
        </select>
      </div>

      {list.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {fStatus === "open" ? "Nothing open. Every question so far had an answer." : "No questions here."}
        </Card>
      ) : (
        <Card className="divide-y p-0">
          {list.map((q) => (
            <div key={q.id} className={cn("flex flex-col gap-3 p-3 lg:flex-row lg:items-center", busy === q.id && "opacity-60")}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-medium">{q.question}</p>
                  <Badge variant={BADGE[q.status]}>{KB_QUESTION_STATUS_LABELS[q.status]}</Badge>
                  {q.partial && <Badge>Partly answered</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Asked {q.timesAsked} {q.timesAsked === 1 ? "time" : "times"}
                  {mounted ? ` · last ${formatDateTime(q.lastAskedAt)}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <Link
                  href={`/jmp-admin/knowledge-base/articles/new?title=${encodeURIComponent(q.question)}`}
                  className={cn(buttonVariants({ variant: "outline" }), "px-3")}
                >
                  <Plus className="size-3.5" aria-hidden />
                  Write article
                </Link>
                {q.status !== "covered" && (
                  <Button variant="ghost" disabled={busy === q.id} onClick={() => setStatus(q, "covered")}>
                    <Check className="size-3.5" aria-hidden />
                    Covered
                  </Button>
                )}
                {q.status === "open" ? (
                  <Button variant="ghost" disabled={busy === q.id} onClick={() => setStatus(q, "dismissed")}>
                    <X className="size-3.5" aria-hidden />
                    Dismiss
                  </Button>
                ) : (
                  <Button variant="ghost" disabled={busy === q.id} onClick={() => setStatus(q, "open")}>
                    Reopen
                  </Button>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
