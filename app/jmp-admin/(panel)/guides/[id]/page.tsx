// Edit a How-to guide (admin).

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/current-user";
import { loadGuide } from "@/lib/guides-data";
import { GuideEditor } from "@/components/admin/guides/guide-editor";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditGuidePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const topic = await loadGuide(id);
  if (!topic) notFound();
  const { created } = await searchParams;
  return (
    <GuideEditor
      key={topic.id}
      topic={topic}
      justCreated={created === "1"}
    />
  );
}
