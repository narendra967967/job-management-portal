"use client";

// Hydrates the client workspace store from server-loaded data. Rendered by the
// dashboard layout (a Server Component) around the whole shell, so both the
// top-bar and the page content read real data from first render.

import { hydrateWorkspace } from "@/lib/mock-store";
import type { WorkspaceData } from "@/lib/queries";

export function WorkspaceProvider({
  initial,
  children,
}: {
  initial: WorkspaceData;
  children: React.ReactNode;
}) {
  hydrateWorkspace(initial);
  return <>{children}</>;
}
