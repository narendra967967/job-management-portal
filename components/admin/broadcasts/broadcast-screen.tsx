"use client";

// /jmp-admin/broadcasts/[id]: drafts and scheduled sends open in the editor;
// anything that has started shows its progress instead.

import Link from "next/link";
import { Card } from "@/components/admin/ui/card";
import { BroadcastEditor } from "@/components/admin/broadcasts/broadcast-editor";
import { BroadcastDetail } from "@/components/admin/broadcasts/broadcast-detail";
import { resolveBroadcast, useBroadcast, useNow } from "@/lib/broadcasts-mock";
import { useMounted } from "@/lib/use-mounted";

export function BroadcastScreen({ id, appName }: { id: string; appName: string }) {
  const mounted = useMounted();
  const now = useNow(1000);
  const raw = useBroadcast(id);
  // Sample data lives in the browser, so wait for it before saying "not found".
  if (!mounted) return null;
  if (!raw) {
    return (
      <Card className="mx-auto max-w-3xl p-8 text-center text-sm text-muted-foreground">
        This broadcast doesn&apos;t exist.{" "}
        <Link href="/jmp-admin/broadcasts" className="font-medium text-primary hover:underline">
          Back to Broadcasts
        </Link>
      </Card>
    );
  }
  const b = resolveBroadcast(raw, now);
  return b.status === "draft" || b.status === "scheduled" ? (
    <BroadcastEditor key={`${b.id}-${b.status}`} existing={b} appName={appName} />
  ) : (
    <BroadcastDetail broadcast={b} appName={appName} />
  );
}
