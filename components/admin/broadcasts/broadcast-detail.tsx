"use client";

// One broadcast that's going out, has gone, or was canceled: how far it got,
// and the message itself.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Eye, Mail, Megaphone, StopCircle, Trash2 } from "lucide-react";
import { Card } from "@/components/admin/ui/card";
import { Button } from "@/components/admin/ui/button";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { toast } from "@/components/admin/ui/toast";
import { BroadcastPreview, CategoryBadge, StatusBadge } from "@/components/admin/broadcasts/broadcast-bits";
import { cancelBroadcastAction, deleteBroadcastAction, duplicateBroadcastAction } from "@/actions/admin-broadcasts";
import { BROADCAST_CHANNELS, sendsEmail, sendsInApp, type Broadcast } from "@/lib/broadcasts-model";
import { useMounted } from "@/lib/use-mounted";
import { formatDateTime } from "@/lib/utils";

function Bar({ done, failed, skipped, total }: { done: number; failed: number; skipped: number; total: number }) {
  const pct = (n: number) => (total ? `${(n / total) * 100}%` : "0%");
  return (
    <div
      className="flex h-2 overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={`${done} sent, ${failed} failed, ${skipped} skipped, of ${total}`}
    >
      <span className="bg-primary transition-[width]" style={{ width: pct(done) }} />
      <span className="bg-destructive transition-[width]" style={{ width: pct(failed) }} />
      <span className="bg-muted-foreground/40 transition-[width]" style={{ width: pct(skipped) }} />
    </div>
  );
}

export function BroadcastDetail({ broadcast: b, appName }: { broadcast: Broadcast; appName: string }) {
  const router = useRouter();
  const mounted = useMounted();
  const [preview, setPreview] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const d = b.delivery;

  // While it's going out, keep the numbers moving.
  useEffect(() => {
    if (b.status !== "sending") return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [b.status, router]);

  async function act<T extends { ok: boolean }>(fn: () => Promise<T>): Promise<T | null> {
    setBusy(true);
    try {
      const r = await fn();
      if (!r.ok) toast.error((r as { error?: string }).error ?? "Something went wrong.");
      return r.ok ? r : null;
    } catch {
      toast.error("That didn't go through. Check your connection and try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }
  const waiting = d ? Math.max(0, d.emailTotal - d.emailSent - d.emailFailed - d.emailSkipped) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
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
                <Bar done={d.emailSent} failed={d.emailFailed} skipped={d.emailSkipped} total={d.emailTotal} />
                <p className="text-xs text-muted-foreground">
                  {d.emailFailed > 0 && `${d.emailFailed} failed after 3 tries. `}
                  {d.emailSkipped > 0 && `${d.emailSkipped} skipped${d.skipReason ? ` (${d.skipReason.toLowerCase()})` : ""}. `}
                  {b.status === "sending" && waiting > 0 && `${waiting} waiting. They go out one every few seconds so the mail server doesn't block us.`}
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
            disabled={busy}
            onClick={async () => {
              const r = await act(() => duplicateBroadcastAction(b.id));
              if (r && "id" in r) router.push(`/jmp-admin/broadcasts/${r.id}`);
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
          {b.status === "canceled" && !b.startedAt && (
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
        onConfirm={async () => {
          if (!(await act(() => cancelBroadcastAction(b.id)))) return;
          toast.success("Sending stopped");
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this broadcast?"
        description="It never went out, so nothing else changes. It's gone for good."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!(await act(() => deleteBroadcastAction(b.id)))) return;
          toast.success("Broadcast deleted");
          router.push("/jmp-admin/broadcasts");
          router.refresh();
        }}
      />
    </div>
  );
}
