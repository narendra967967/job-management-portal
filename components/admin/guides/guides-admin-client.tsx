"use client";

// How-to guides list (admin). A flat list in the order users see it. Row actions: edit, activate / deactivate, move up /
// down, delete (confirmed). Data comes from the server page; each change goes
// through a Server Action, then router.refresh() re-reads.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ExternalLink, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { Card } from "@/components/admin/ui/card";
import { Button, buttonVariants } from "@/components/admin/ui/button";
import { Badge } from "@/components/admin/ui/badge";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import {
  deleteGuideAction,
  moveGuideAction,
  setGuideStatusAction,
} from "@/actions/admin-guides";
import type { GuideTopic } from "@/lib/guides-model";
import { guideIcon } from "@/lib/guide-icons";
import { useMounted } from "@/lib/use-mounted";
import { cn, formatDateTime } from "@/lib/utils";

export function GuidesAdminClient({ topics }: { topics: GuideTopic[] }) {
  const router = useRouter();
  const mounted = useMounted();
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GuideTopic | null>(null);
  const [flash, setFlash] = useState("");
  const [flashErr, setFlashErr] = useState(false);

  const activeCount = topics.filter((t) => t.status === "active").length;

  function say(msg: string, err = false) {
    setFlash(msg);
    setFlashErr(err);
    setTimeout(() => setFlash((m) => (m === msg ? "" : m)), 2800);
  }

  async function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) {
    setBusy(id);
    const res = await fn();
    setBusy(null);
    if (res.ok) {
      if (okMsg) say(okMsg);
      router.refresh();
    } else say(res.error ?? "Something went wrong.", true);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {topics.length} {topics.length === 1 ? "guide" : "guides"} · {activeCount} live
        </p>
        <Link href="/jmp-admin/guides/new" className={cn(buttonVariants(), "px-3")}>
          <Plus className="size-4" aria-hidden />
          Add guide
        </Link>
      </div>

      {flash && (
        <p
          role="status"
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            flashErr ? "bg-destructive/10 text-destructive" : "bg-status-applied text-status-applied-foreground",
          )}
        >
          {flash}
        </p>
      )}

      {topics.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No guides yet.{" "}
          <Link href="/jmp-admin/guides/new" className="font-medium text-primary hover:underline">
            Add the first one
          </Link>
          .
        </Card>
      ) : (
            <Card className="divide-y p-0">
              {topics.map((t, idx) => {
                const Icon = guideIcon(t.icon);
                const live = t.status === "active";
                const rowBusy = busy === t.id;
                const words = t.contentHtml.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
                return (
                  <div
                    key={t.id}
                    className={cn("flex flex-col gap-3 p-3 sm:flex-row sm:items-center", rowBusy && "opacity-60")}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg",
                          live ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link
                            href={`/jmp-admin/guides/${t.id}`}
                            className="truncate text-sm font-medium hover:text-primary"
                          >
                            {t.title}
                          </Link>
                          <Badge variant={live ? "success" : "neutral"}>{live ? "Active" : "Inactive"}</Badge>
                          {t.inProgress && <Badge variant="warning">In progress</Badge>}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          /guides?topic={t.slug} · {words} {words === 1 ? "word" : "words"}
                          {mounted ? ` · updated ${formatDateTime(t.updatedAt)}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1 sm:shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${t.title} up`}
                        title="Move up"
                        disabled={rowBusy || idx === 0}
                        onClick={() => run(t.id, () => moveGuideAction(t.id, "up"))}
                      >
                        <ArrowUp className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${t.title} down`}
                        title="Move down"
                        disabled={rowBusy || idx === topics.length - 1}
                        onClick={() => run(t.id, () => moveGuideAction(t.id, "down"))}
                      >
                        <ArrowDown className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="outline"
                        size="default"
                        disabled={rowBusy}
                        onClick={() =>
                          run(
                            t.id,
                            () => setGuideStatusAction(t.id, live ? "inactive" : "active"),
                            live ? `“${t.title}” is hidden from users.` : `“${t.title}” is live.`,
                          )
                        }
                      >
                        <Power className="size-3.5" aria-hidden />
                        {live ? "Deactivate" : "Activate"}
                      </Button>
                      <Link href={`/jmp-admin/guides/${t.id}`} className={cn(buttonVariants({ variant: "outline" }))}>
                        <Pencil className="size-3.5" aria-hidden />
                        Edit
                      </Link>
                      {live && (
                        <a
                          href={`/guides?topic=${t.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`View ${t.title} on the site`}
                          title="View on site"
                          className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                        >
                          <ExternalLink className="size-4" aria-hidden />
                        </a>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${t.title}`}
                        title="Delete"
                        disabled={rowBusy}
                        onClick={() => setDeleteTarget(t)}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </Card>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete “${deleteTarget?.title ?? ""}”?`}
        description="The guide and all its content are removed for good. To hide it for now, deactivate it instead."
        confirmLabel="Delete guide"
        destructive
        onConfirm={async () => {
          const t = deleteTarget;
          setDeleteTarget(null);
          if (t) await run(t.id, () => deleteGuideAction(t.id), `Deleted “${t.title}”.`);
        }}
      />
    </div>
  );
}
