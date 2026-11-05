"use client";

// One notification, opened. Broadcasts show their full message; system notices
// show their text and a link to whatever they're about.

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { markNotificationReadAction } from "@/actions/notifications";
import { BROADCAST_CATEGORIES } from "@/lib/broadcasts-model";
import type { NotificationDetail } from "@/lib/notifications";
import { useMounted } from "@/lib/use-mounted";
import { cn, formatDateTime } from "@/lib/utils";

export function NotificationView({ n }: { n: NotificationDetail }) {
  const mounted = useMounted();

  // Opened from an email or a saved link, without going through the bell.
  useEffect(() => {
    if (!n.read) void markNotificationReadAction(n.id).catch(() => {});
  }, [n.id, n.read]);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <Link href="/notifications" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        All notifications
      </Link>
      <article className="rounded-2xl border bg-card p-4 md:p-6">
        <p className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {n.broadcastCategory && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                n.broadcastCategory === "important" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
              )}
            >
              {BROADCAST_CATEGORIES[n.broadcastCategory].label}
            </span>
          )}
          {mounted ? formatDateTime(n.createdAt) : ""}
        </p>
        <h1 className="mb-4 text-xl font-semibold">{n.title}</h1>
        {n.contentHtml ? (
          // Sanitized when the admin saved the broadcast.
          <div className="guide-content text-sm" dangerouslySetInnerHTML={{ __html: n.contentHtml }} />
        ) : (
          <p className="text-sm whitespace-pre-line">{n.body}</p>
        )}
        {n.href && !n.broadcastCategory && (
          <Link href={n.href} className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>
            Open
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
        {n.broadcastCategory === "promotional" && (
          <p className="mt-6 border-t pt-3 text-xs text-muted-foreground">
            Rather not get messages like this?{" "}
            <Link href="/settings?tab=notifications" className="font-medium text-primary hover:underline">
              Turn off promotional messages
            </Link>
          </p>
        )}
      </article>
    </div>
  );
}
