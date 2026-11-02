// Knowledge base → edit an article.

import { Suspense } from "react";
import { requireAdmin } from "@/lib/current-user";
import { KbArticleEditor } from "@/components/admin/kb/kb-article-editor";

export default async function EditKbArticlePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  return (
    <Suspense>
      <KbArticleEditor key={id} articleId={id} />
    </Suspense>
  );
}
