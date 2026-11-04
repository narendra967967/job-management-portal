"use client";

// One broadcast that's going out, has gone, or was canceled: how far it got,
// and the message itself.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Eye, Mail, Megaphone, StopCircle, Trash2 } from "lucide-react";
import { Card } from "@/components/admin/ui/card";
import { Button } from "@/components/admin/ui/button";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { toast } from "@/components/admin/ui/toast";
import { BroadcastPreview, CategoryBadge, SampleBanner, StatusBadge } from "@/components/admin/broadcasts/broadcast-bits";
import { cancelBroadcast, deleteBroadcast, duplicateBroadcast } from "@/lib/broadcasts-mock";
import { BROADCAST_CHANNELS, sendsEmail, sendsInApp, type Broadcast } from "@/lib/broadcasts-model";
import { useMounted } from "@/lib/use-mounted";
import { formatDateTime } from "@/lib/utils";

function Bar({ done, failed, total }: { done: number; failed: number; total: number }) {
  const pct = (n: number) => (total ? `${(n / total) * 100}%` : "0%");
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${done} sent, ${failed} failed, of ${total}`}>
      <span className="bg-primary transition-[width]" style={{ width: pct(done) }} />
      <span className="bg-destructive transition-[width]" style={{ width: pct(failed) }} />
    </div>
  );
}

export function BroadcastDetail({ broadcast: b, appName }: { broadcast: Broadcast; appName: string }) {
  const router = useRouter();
  const mounted = useMounted();
  const [preview, setPreview] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const d = b.delivery;
  const waiting = d ? d.emailTotal - d.emailSent - d.emailFailed : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <SampleBanner />
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <CategoryBadge category={b.category} />
          <StatusBadge status={b.status} />
          <span className="text-xs text-muted-foreground">{BROADCAST_CHANNELS[b.channel]}</span>
        </div>
        <h2 className="text-lg font-semibold">{b.title}</h2>
        <p className="text-xs text-muted-foreground">
          {b.createdBy}
          {mounted && b.startedAt && ` · started ${formatDateTime(b.startedAt)}`}
          {mounted && b.finishedAt && ` · finished ${formatDateTime(b.finishedAt)}`}
          {mounted && b.canceledAt && ` · canceled ${formatDateTime(b.canceledAt)}`}
          {mounted && !b.startedAt && b.scheduledFor && ` · was due ${formatDateTime(b.scheduledFor)}`}
        </p>

        {d && (
          <div className="space-y-3 border-t pt-3">
            {sendsInApp(b.channel) && (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-1.5">
                  <Megaphone className="size-4 text-muted-foreground" aria-hidden />
                  In the app
                </span>
                <span className="tabular-nums">Delivered to {d.inApp} users</span>
              </div>
            )}
            {sendsEmail(b.channel) && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Mail className="size-4 text-muted-foreground" aria-hidden />
                    Email
                  </span>
                  <span className="tabular-nums">
                    {d.emailSent} of {d.emailTotal} sent
                  </span>
                </div>
                <Bar done={d.emailSent} failed={d.emailFailed} total={d.emailTotal} />
                <p className="text-xs text-muted-foreground">
                  {d.emailFailed > 0 && `${d.emailFailed} failed after 3 tries. `}
                  {b.status === "sending" && waiting > 0 && `${waiting} waiting. Sent a few at a time so the mail server doesn't block us.`}
                  {b.status === "canceled" && waiting > 0 && `${waiting} were never sent.`}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t pt-3">
          <Button variant="outline" onClick={() => setPreview(true)}>
            <Eye className="size-4" aria-hidden />
            Preview
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const id = duplicateBroadcast(b.id);
              if (id) router.push(`/jmp-admin/broadcasts/${id}`);
            }}
          >
            <Copy className="size-4" aria-hidden />
            Duplicate
          </Button>
          {b.status === "sending" && sendsEmail(b.channel) && (
            <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmStop(true)}>
              <StopCircle className="size-4" aria-hidden />
              Stop sending
            </Button>
          )}
          {b.status === "canceled" && (
            <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" aria-hidden />
              Delete
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <div className="guide-content text-sm" dangerouslySetInnerHTML={{ __html: b.contentHtml }} />
      </Card>

      <BroadcastPreview
        open={preview}
        onOpenChange={setPreview}
        title={b.title}
        contentHtml={b.contentHtml}
        category={b.category}
        channel={b.channel}
        appName={appName}
      />
      <ConfirmDialog
        open={confirmStop}
        onOpenChange={setConfirmStop}
        title="Stop sending?"
        description={`The ${waiting} emails still waiting won't go out. Emails already sent and in-app messages stay where they are.`}
        confirmLabel="Stop sending"
        destructive
        onConfirm={() => {
          cancelBroadcast(b.id);
          toast.success("Sending stopped");
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this broadcast?"
        description="It comes off this list. Anything it already delivered stays with users."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          deleteBroadcast(b.id);
          toast.success("Broadcast deleted");
          router.push("/jmp-admin/broadcasts");
        }}
      />
    </div>
  );
}
