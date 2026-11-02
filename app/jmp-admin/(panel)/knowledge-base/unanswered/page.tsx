// Knowledge base → Unanswered questions.

import { requireAdmin } from "@/lib/current-user";
import { KbUnanswered } from "@/components/admin/kb/kb-unanswered";

export default async function KnowledgeBaseUnansweredPage() {
  await requireAdmin();
  return <KbUnanswered />;
}
