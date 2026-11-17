import { requireAdmin } from "@/lib/current-user";
import { AiInterviewsClient } from "@/components/admin/mock-interviews/ai-interviews-client";
import { SHOW_SAMPLE_SCREENS } from "@/lib/mock-interviews/preview";
import { AdminComingSoon } from "@/components/admin/mock-interviews/admin-coming-soon";

// Admin → Mock interviews → AI interviews: usage, sessions with their event
// log, and credits. PHASE R1.3: sample sessions, outside production only.
export const dynamic = "force-dynamic";

export default async function AdminAiInterviewsPage() {
  await requireAdmin();
  if (!SHOW_SAMPLE_SCREENS) return <AdminComingSoon title="AI interviews" />;
  return <AiInterviewsClient />;
}
