"use client";

// History: past conversations with the agent, newest first. Opening one
// continues it on the Ask tab.

import { useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquare, Search, Trash2 } from "lucide-react";
import { Card } from "@/components/admin/ui/card";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { toast } from "@/components/admin/ui/toast";
import { deleteConversation, useKb } from "@/lib/kb-mock";
import type { KbConversation } from "@/lib/kb-model";
import { useMounted } from "@/lib/use-mounted";
import { formatDateTime } from "@/lib/utils";

export function KbHistory() {
  const { conversations } = useKb();
  const mounted = useMounted();
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<KbConversation | null>(null);

  const list = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return conversations
      .filter((c) => {
        const hay = c.messages.map((m) => m.text).join(" ").toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [conversations, query]);

  return (
    <div className="space-y-4">
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
          {list.map((c) => {
            const unanswered = c.messages.filter((m) => m.unanswered).length;
            return (
              <div key={c.id} className="flex items-center gap-2 p-1.5 pl-3">
                <Link href={`/jmp-admin/knowledge-base?c=${c.id}`} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg py-1.5 hover:text-primary">
                  <MessageSquare className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{c.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {c.messages.length} {c.messages.length === 1 ? "message" : "messages"}
                      {unanswered > 0 ? ` · ${unanswered} unanswered` : ""}
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
            );
          })}
        </Card>
      )}

      <ConfirmDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title="Delete this conversation?"
        description="It's removed for good. Questions it added to Unanswered stay there."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          const c = target;
          setTarget(null);
          if (c) {
            deleteConversation(c.id);
            toast.success("Conversation deleted.");
          }
        }}
      />
    </div>
  );
}
