// Knowledge base → Ask (the agent). ?c=<id> reopens one of this admin's conversations.

import { requireAdmin } from "@/lib/current-user";
import { loadKbConversation } from "@/lib/kb-data";
import { KbAsk } from "@/components/admin/kb/kb-ask";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function KnowledgeBaseAskPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const adminId = await requireAdmin();
  const { c } = await searchParams;
  const conversation = c && UUID.test(c) ? await loadKbConversation(adminId, c) : null;
  return <KbAsk key={conversation?.id ?? "new"} conversation={conversation} />;
}
