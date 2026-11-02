// Knowledge base → new article. ?title= prefills it from an unanswered question.

import { Suspense } from "react";
import { requireAdmin } from "@/lib/current-user";
import { KbArticleEditor } from "@/components/admin/kb/kb-article-editor";

export default async function NewKbArticlePage() {
  await requireAdmin();
  return (
    <Suspense>
      <KbArticleEditor />
    </Suspense>
  );
}
