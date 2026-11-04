// Knowledge base → this admin's conversation History.

import { requireAdmin } from "@/lib/current-user";
import { loadKbConversations, loadKbUsage } from "@/lib/kb-data";
import { KbHistory } from "@/components/admin/kb/kb-history";

export default async function KnowledgeBaseHistoryPage() {
  const adminId = await requireAdmin();
  const [conversations, usage] = await Promise.all([loadKbConversations(adminId), loadKbUsage()]);
  return <KbHistory conversations={conversations} usage={usage} />;
}
