// Knowledge base → Unanswered questions.

import { requireAdmin } from "@/lib/current-user";
import { loadKbQuestions } from "@/lib/kb-data";
import { KbUnanswered } from "@/components/admin/kb/kb-unanswered";

export default async function KnowledgeBaseUnansweredPage() {
  await requireAdmin();
  return <KbUnanswered questions={await loadKbQuestions()} />;
}
