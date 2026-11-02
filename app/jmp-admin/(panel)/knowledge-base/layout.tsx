// Admin knowledge base: tabs over every page. Admin only, permanently.

import { requireAdmin } from "@/lib/current-user";
import { KbNav } from "@/components/admin/kb/kb-nav";

export const dynamic = "force-dynamic";

export default async function KnowledgeBaseLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <KbNav />
      {children}
    </div>
  );
}
