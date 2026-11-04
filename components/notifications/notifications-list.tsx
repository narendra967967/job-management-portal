"use client";

// Notifications: everything saved for this user, newest first. Announcements
// from the team (broadcasts) sit alongside system notices like cleanup
// summaries. Due follow-ups and new leads live on their own pages instead.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight, Megaphone } from "lucide-react";
import { markInboxRead, useInbox } from "@/lib/broadcasts-mock";
import { markNotificationsRead, useNotificationHistory } from "@/lib/mock-store";
import { BROADCAST_CATEGORIES, broadcastExcerpt, type BroadcastCategory } from "@/lib/broadcasts-model";
import { useMounted } from "@/lib/use-mounted";
import { cn, formatDateTime } from "@/lib/utils";

interface Row {
  id: string;
  title: string;
  excerpt: string;
  at: string;
  read: boolean;
  category?: BroadcastCategory;
}

export function NotificationsList() {
  const mounted = useMounted();
  const stored = useNotificationHistory();
  const inbox = useInbox();

  const rows: Row[] = [
    ...inbox.map((b) => ({ id: b.id, title: b.title, excerpt: broadcastExcerpt(b.contentHtml), at: b.at, read: b.read, category: b.category })),
    ...stored.map((n) => ({ id: n.id, title: n.title, excerpt: n.body, at: n.createdAt, read: n.read })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  // Showing the list counts as seeing them, same as opening the bell. What was
  // unread on arrival keeps its dot for this visit, so it's clear what's new.
  const [newOnArrival, setNewOnArrival] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!mounted || newOnArrival) return;
    setNewOnArrival(new Set(rows.filter((r) => !r.read).map((r) => r.id)));
    markNotificationsRead();
    markInboxRead(inbox.map((b) => b.broadcastId));
  }, [mounted, newOnArrival, rows, inbox]);
  const isNew = (r: Row) => !r.read || !!newOnArrival?.has(r.id);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-lg font-semibold">Notifications</h1>
      {rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Nothing here yet. Messages from the team and notices about your leads show up here.
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/notifications/${r.id}`} className="flex min-h-11 items-start gap-3 px-4 py-3 hover:bg-muted/50">
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                    r.category ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {r.category ? <Megaphone className="size-4" aria-hidden /> : <Bell className="size-4" aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className={cn("text-sm", isNew(r) ? "font-semibold" : "font-medium")}>{r.title}</span>
                    {r.category === "important" && (
                      <span className="rounded-full bg-destructive/10 px-1.5 text-[10px] font-medium text-destructive">
                        {BROADCAST_CATEGORIES.important.label}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">{r.excerpt}</span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">{mounted ? formatDateTime(r.at) : ""}</span>
                </span>
                {isNew(r) && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                <ChevronRight className="mt-1.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
