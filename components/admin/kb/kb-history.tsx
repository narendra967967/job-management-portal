"use client";

// History: this admin's past conversations with the agent, newest first.
// Opening one continues it on the Ask tab. Above them, this month's usage
// across all admins, since that's what the AI bill follows.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare, Search, Trash2 } from "lucide-react";
import { Card } from "@/components/admin/ui/card";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { toast } from "@/components/admin/ui/toast";
import { deleteKbConversationAction } from "@/actions/admin-kb";
import type { KbConversationSummary, KbUsage } from "@/lib/kb-model";
import { useMounted } from "@/lib/use-mounted";
import { formatDateTime } from "@/lib/utils";

const USAGE: { key: keyof KbUsage; label: string }[] = [
  { key: "questions", label: "Questions" },
  { key: "answered", label: "Answered" },
  { key: "partial", label: "Partly answered" },
  { key: "unanswered", label: "Not found" },
  { key: "fallback", label: "Without AI" },
];

function UsageRow({ usage }: { usage: KbUsage }) {
  return (
    <section aria-labelledby="kb-usage">
      <h2 id="kb-usage" className="mb-2 text-sm font-semibold">This month</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {USAGE.map((u) => (
          <Card key={u.key} className="px-3 py-2.5">
            <p className="text-xl font-semibold tabular-nums">{usage[u.key]}</p>
            <p className="text-xs text-muted-foreground">{u.label}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function KbHistory({ conversations, usage }: { conversations: KbConversationSummary[]; usage: KbUsage }) {
  const router = useRouter();
  const mounted = useMounted();
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<KbConversationSummary | null>(null);

  const list = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return conversations.filter((c) => words.every((w) => c.title.toLowerCase().includes(w)));
  }, [conversations, query]);

  return (
    <div className="space-y-4">
      <UsageRow usage={usage} />
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations…"
          aria-label="Search conversations"
          className="h-11 pl-8 sm:h-9"
        />
      </div>

      {list.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {conversations.length === 0 ? "No conversations yet." : "No conversations match."}
        </Card>
      ) : (
        <Card className="divide-y p-0">
          {list.map((c) => (
            <div key={c.id} className="flex items-center gap-2 p-1.5 pl-3">
              <Link
                href={`/jmp-admin/knowledge-base?c=${c.id}`}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg py-1.5 hover:text-primary"
              >
                <MessageSquare className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{c.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {c.messageCount} {c.messageCount === 1 ? "message" : "messages"}
                    {c.unansweredCount > 0 ? ` · ${c.unansweredCount} unanswered` : ""}
                    {mounted ? ` · ${formatDateTime(c.updatedAt)}` : ""}
                  </span>
                </span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${c.title}`}
                title="Delete"
                onClick={() => setTarget(c)}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          ))}
        </Card>
      )}

      <ConfirmDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title="Delete this conversation?"
        description="It's removed for good. Questions it added to Unanswered stay there."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          const c = target;
          setTarget(null);
          if (!c) return;
          const res = await deleteKbConversationAction(c.id);
          if (!res.ok) return toast.error(res.error);
          toast.success("Conversation deleted.");
          router.refresh();
        }}
      />
    </div>
  );
}
