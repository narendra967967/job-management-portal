// Knowledge base → Ask (the agent). Suspense: the chat reads ?c= for a past conversation.

import { Suspense } from "react";
import { requireAdmin } from "@/lib/current-user";
import { KbAsk } from "@/components/admin/kb/kb-ask";

export default async function KnowledgeBaseAskPage() {
  await requireAdmin();
  return (
    <Suspense>
      <KbAsk />
    </Suspense>
  );
}
