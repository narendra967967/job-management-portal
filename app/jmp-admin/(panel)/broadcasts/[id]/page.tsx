// Admin → Broadcasts → one broadcast: the editor until it starts, then its progress.

import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/current-user";
import { getAppName } from "@/lib/branding";
import { loadAudiences, loadBroadcast } from "@/lib/broadcasts-data";
import { BroadcastEditor } from "@/components/admin/broadcasts/broadcast-editor";
import { BroadcastDetail } from "@/components/admin/broadcasts/broadcast-detail";

export const dynamic = "force-dynamic";

export default async function BroadcastPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [b, appName] = await Promise.all([loadBroadcast(id), getAppName()]);
  if (!b) notFound();
  if (b.status === "draft" || b.status === "scheduled") {
    return <BroadcastEditor key={`${b.id}-${b.updatedAt}`} existing={b} audiences={await loadAudiences()} appName={appName} />;
  }
  return <BroadcastDetail broadcast={b} appName={appName} />;
}
