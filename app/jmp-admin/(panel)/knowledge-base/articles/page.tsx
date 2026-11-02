// Knowledge base → Articles.

import { requireAdmin } from "@/lib/current-user";
import { KbArticles } from "@/components/admin/kb/kb-articles";

export default async function KnowledgeBaseArticlesPage() {
  await requireAdmin();
  return <KbArticles />;
}
