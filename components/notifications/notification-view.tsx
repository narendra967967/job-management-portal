"use client";

// One notification, opened. Broadcasts show their full message; system notices
// show their text and a link to whatever they're about.

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { markInboxRead, useInbox } from "@/lib/broadcasts-mock";
import { useNotificationHistory } from "@/lib/mock-store";
import { BROADCAST_CATEGORIES } from "@/lib/broadcasts-model";
import { useMounted } from "@/lib/use-mounted";
import { cn, formatDateTime } from "@/lib/utils";

export function NotificationView({ id }: { id: string }) {
  const mounted = useMounted();
  const inbox = useInbox();
  const stored = useNotificationHistory();
  const broadcast = inbox.find((b) => b.id === id);
  const notice = stored.find((n) => n.id === id);

  useEffect(() => {
    if (broadcast && !broadcast.read) markInboxRead([broadcast.broadcastId]);
  }, [broadcast]);

  const back = (
    <Link href="/notifications" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden />
      All notifications
    </Link>
  );

  // Sample broadcasts live in the browser, so wait before saying it's gone.
  if (!mounted) return <div className="mx-auto max-w-3xl">{back}</div>;

  if (!broadcast && !notice) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        {back}
        <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
          This notification isn&apos;t here anymore. Older ones are cleared out after a while.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {back}
      <article className="rounded-2xl border bg-card p-4 md:p-6">
        {broadcast ? (
          <>
            <p className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  broadcast.category === "important" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
                )}
              >
                {BROADCAST_CATEGORIES[broadcast.category].label}
              </span>
              {formatDateTime(broadcast.at)}
            </p>
            <h1 className="mb-4 text-xl font-semibold">{broadcast.title}</h1>
            <div className="guide-content text-sm" dangerouslySetInnerHTML={{ __html: broadcast.contentHtml }} />
            {broadcast.category === "promotional" && (
              <p className="mt-6 border-t pt-3 text-xs text-muted-foreground">
                Rather not get messages like this?{" "}
                <Link href="/settings?tab=notifications" className="font-medium text-primary hover:underline">
                  Turn off promotional messages
                </Link>
              </p>
            )}
          </>
        ) : (
          notice && (
            <>
              <p className="mb-2 text-xs text-muted-foreground">{formatDateTime(notice.createdAt)}</p>
              <h1 className="mb-3 text-xl font-semibold">{notice.title}</h1>
              <p className="text-sm whitespace-pre-line">{notice.body}</p>
              {notice.href && (
                <Link href={notice.href} className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>
                  Open
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              )}
            </>
          )
        )}
      </article>
    </div>
  );
}
