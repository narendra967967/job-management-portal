// Knowledge base → one article: the editor for admin articles, read-only for repo ones.

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/current-user";
import { loadKbArticle } from "@/lib/kb-data";
import { KbArticleEditor } from "@/components/admin/kb/kb-article-editor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function KbArticlePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const found = await loadKbArticle(id);
  if (!found) notFound();
  return <KbArticleEditor key={found.article.id} article={found.article} versions={found.versions} />;
}
