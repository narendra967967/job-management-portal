// How-to guides (user side). Server component: loads the ACTIVE topics, in menu
// order, from the DB (managed in the admin panel) and hands them to the client
// layout. Inactive topics never leave the server.

import { loadActiveGuides } from "@/lib/guides-data";
import { GuidesClient } from "@/components/guides/guides-client";

export const dynamic = "force-dynamic";

export default async function GuidesPage() {
  const topics = await loadActiveGuides();
  return <GuidesClient topics={topics} />;
}
