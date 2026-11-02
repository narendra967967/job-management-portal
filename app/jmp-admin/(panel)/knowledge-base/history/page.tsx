// Knowledge base → conversation History.

import { requireAdmin } from "@/lib/current-user";
import { KbHistory } from "@/components/admin/kb/kb-history";

export default async function KnowledgeBaseHistoryPage() {
  await requireAdmin();
  return <KbHistory />;
}
