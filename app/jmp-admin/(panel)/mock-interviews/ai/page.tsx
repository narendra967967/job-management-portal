import { requireAdmin } from "@/lib/current-user";
import { AiInterviewsClient } from "@/components/admin/mock-interviews/ai-interviews-client";
import { loadAdminSessions } from "@/lib/mock-interviews/admin-data";

// Admin → Mock interviews → AI interviews: usage and cost, each session's event
// log, and giving an interview back (spec D13, D55).
export const dynamic = "force-dynamic";

export default async function AdminAiInterviewsPage() {
  await requireAdmin();
  const { rows, capped } = await loadAdminSessions();
  return <AiInterviewsClient rows={rows} capped={capped} />;
}
