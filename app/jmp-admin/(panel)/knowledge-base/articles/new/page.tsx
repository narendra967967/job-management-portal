// Knowledge base → new article. ?title= prefills it from an unanswered question.

import { requireAdmin } from "@/lib/current-user";
import { KbArticleEditor } from "@/components/admin/kb/kb-article-editor";

export default async function NewKbArticlePage({ searchParams }: { searchParams: Promise<{ title?: string }> }) {
  await requireAdmin();
  const { title } = await searchParams;
  return <KbArticleEditor initialTitle={(title ?? "").slice(0, 120)} />;
}
