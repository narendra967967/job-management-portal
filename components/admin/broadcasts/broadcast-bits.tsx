"use client";

// Small pieces shared by the Broadcasts screens: badges and the in-app / email
// preview.

import { useState } from "react";
import { Mail, Megaphone } from "lucide-react";
import { Badge } from "@/components/admin/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/admin/ui/dialog";
import {
  BROADCAST_CATEGORIES,
  BROADCAST_STATUS_LABELS,
  broadcastExcerpt,
  sendsEmail,
  sendsInApp,
  type BroadcastCategory,
  type BroadcastChannel,
  type BroadcastStatus,
} from "@/lib/broadcasts-model";
import { cn } from "@/lib/utils";

export const selectCls =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none sm:h-9 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function CategoryBadge({ category }: { category: BroadcastCategory }) {
  return <Badge variant={category === "important" ? "danger" : "neutral"}>{BROADCAST_CATEGORIES[category].label}</Badge>;
}

const STATUS_VARIANT: Record<BroadcastStatus, "neutral" | "warning" | "success" | "danger"> = {
  draft: "neutral",
  scheduled: "warning",
  sending: "warning",
  sent: "success",
  canceled: "neutral",
};

export function StatusBadge({ status }: { status: BroadcastStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{BROADCAST_STATUS_LABELS[status]}</Badge>;
}

export function ChannelIcons({ channel }: { channel: BroadcastChannel }) {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      {sendsInApp(channel) && <Megaphone className="size-3.5" aria-label="In the app" />}
      {sendsEmail(channel) && <Mail className="size-3.5" aria-label="Email" />}
    </span>
  );
}

/** What users will see: the bell entry and message page, and the email. */
export function BroadcastPreview({
  open,
  onOpenChange,
  title,
  contentHtml,
  category,
  channel,
  appName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  contentHtml: string;
  category: BroadcastCategory;
  channel: BroadcastChannel;
  appName: string;
}) {
  const views = [...(sendsInApp(channel) ? (["app"] as const) : []), ...(sendsEmail(channel) ? (["email"] as const) : [])];
  const [view, setView] = useState<"app" | "email">(views[0] ?? "app");
  const shown = views.includes(view as never) ? view : views[0];
  const heading = title.trim() || "Untitled broadcast";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Preview</DialogTitle>
        </DialogHeader>
        {views.length > 1 && (
          <div className="flex gap-1" role="tablist" aria-label="Preview">
            {views.map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={shown === v}
                onClick={() => setView(v)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium sm:min-h-9",
                  shown === v ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {v === "app" ? <Megaphone className="size-4" aria-hidden /> : <Mail className="size-4" aria-hidden />}
                {v === "app" ? "In the app" : "Email"}
              </button>
            ))}
          </div>
        )}

        {shown === "app" ? (
          <div className="space-y-3">
            <div className="rounded-xl border bg-white/70 p-2.5">
              <p className="mb-1.5 px-1 text-[11px] font-medium text-muted-foreground">In the bell</p>
              <div className="flex items-start gap-2.5 rounded-lg px-1 py-1.5">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Megaphone className="size-3.5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{heading}</span>
                  <span className="block line-clamp-2 text-xs text-muted-foreground">{broadcastExcerpt(contentHtml)}</span>
                </span>
              </div>
            </div>
            <div className="rounded-xl border bg-white/70 p-4">
              <p className="mb-2 text-[11px] font-medium text-muted-foreground">Opened</p>
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <CategoryBadge category={category} />
              </div>
              <h2 className="mb-3 text-lg font-semibold">{heading}</h2>
              <div className="guide-content text-sm" dangerouslySetInnerHTML={{ __html: contentHtml }} />
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-[#f4f4f7]">
            <div className="border-b bg-white px-4 py-2.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Subject:</span> {heading}
            </div>
            <div className="p-3 sm:p-5">
              <div className="mx-auto max-w-[560px] overflow-hidden rounded-lg bg-white shadow-sm">
                <div className="bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">{appName}</div>
                <div className="px-5 py-4">
                  <h2 className="mb-3 text-lg font-semibold">{heading}</h2>
                  <div className="guide-content text-sm" dangerouslySetInnerHTML={{ __html: contentHtml }} />
                </div>
                <div className="border-t px-5 py-3 text-[11px] leading-relaxed text-muted-foreground">
                  {category === "promotional" ? (
                    <>
                      You&apos;re getting this because you have a {appName} account.{" "}
                      <span className="text-primary underline">Unsubscribe from promotional messages</span>
                    </>
                  ) : (
                    <>This is a service message about your {appName} account, so it can&apos;t be turned off.</>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
