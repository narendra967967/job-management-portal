// Admin knowledge base: tabs over every page. Admin only, permanently.

import { requireAdmin } from "@/lib/current-user";
import { countOpenKbQuestions } from "@/lib/kb-data";
import { KbNav } from "@/components/admin/kb/kb-nav";

export const dynamic = "force-dynamic";

export default async function KnowledgeBaseLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const openQuestions = await countOpenKbQuestions();
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <KbNav openQuestions={openQuestions} />
      {children}
    </div>
  );
}
