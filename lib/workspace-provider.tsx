"use client";

// Hydrates the client workspace store from server-loaded data. Rendered by the
// dashboard layout (a Server Component) around the whole shell, so both the
// top-bar and the page content read real data from first render. Server renders
// read this request's data through ServerWorkspace (never shared module state).

import { useEffect } from "react";
import { hydrateWorkspace, refreshWorkspace, ServerWorkspace } from "@/lib/mock-store";
import type { WorkspaceData } from "@/lib/queries";

const POLL_MS = 90_000; // while the tab is visible
const MIN_GAP_MS = 20_000; // don't refetch more often than this

export function WorkspaceProvider({
  initial,
  children,
}: {
  initial: WorkspaceData;
  children: React.ReactNode;
}) {
  hydrateWorkspace(initial);
  return (
    <ServerWorkspace data={initial}>
      <WorkspaceRefresher />
      {children}
    </ServerWorkspace>
  );
}

/** Keeps the open tab current with changes made elsewhere — leads from
 *  forwarded emails and the AI reader, edits on another device. Refetches when
 *  the tab comes back into view and every 90 s while it's visible. */
function WorkspaceRefresher() {
  useEffect(() => {
    let last = Date.now();
    let busy = false;
    const pull = async () => {
      if (busy || document.visibilityState !== "visible" || Date.now() - last < MIN_GAP_MS) return;
      busy = true;
      last = Date.now();
      try {
        await refreshWorkspace();
      } catch {
        // Offline or signed out: try again on the next tick.
      } finally {
        busy = false;
      }
    };
    const onVisible = () => void pull();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const timer = setInterval(onVisible, POLL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      clearInterval(timer);
    };
  }, []);
  return null;
}
