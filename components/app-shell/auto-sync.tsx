"use client";

// Local auto-sync: while the dashboard is open, trigger a Gmail sync when the
// user's chosen interval has elapsed since the last run. True background sync
// (app closed) is handled by the production cron; this makes the interval work
// locally today. Renders nothing.

import { useEffect, useRef } from "react";
import { currentSyncInfo, syncGmail } from "@/lib/mock-store";

const CHECK_MS = 2 * 60 * 1000; // re-check every 2 minutes

export function AutoSync() {
  const running = useRef(false);

  useEffect(() => {
    async function maybeSync() {
      if (running.current) return;
      const { intervalHours, lastRunAt, connected } = currentSyncInfo();
      if (!connected) return;
      const due =
        !lastRunAt ||
        Date.now() - new Date(lastRunAt).getTime() >= intervalHours * 3_600_000;
      if (!due) return;
      running.current = true;
      try {
        await syncGmail();
      } catch {
        // Errors surface in the ingestion-issues view / sync status.
      } finally {
        running.current = false;
      }
    }

    const first = setTimeout(maybeSync, 5000); // let hydration settle
    const timer = setInterval(maybeSync, CHECK_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  return null;
}
