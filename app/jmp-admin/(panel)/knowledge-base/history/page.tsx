// Knowledge base → this admin's conversation History.

import { requireAdmin } from "@/lib/current-user";
import { loadKbConversations } from "@/lib/kb-data";
import { KbHistory } from "@/components/admin/kb/kb-history";

export default async function KnowledgeBaseHistoryPage() {
  const adminId = await requireAdmin();
  return <KbHistory conversations={await loadKbConversations(adminId)} />;
}
