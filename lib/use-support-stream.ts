"use client";

// Subscribe to a support SSE endpoint and get parsed events via a callback.
// EventSource handles reconnection itself; we just open/close with the component.

import { useEffect, useRef } from "react";

export function useSupportStream(
  url: string,
  onEvent: (event: Record<string, unknown>) => void,
  enabled = true,
) {
  const cb = useRef(onEvent);
  cb.current = onEvent;
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof EventSource === "undefined") return;
    const es = new EventSource(url);
    es.onmessage = (ev) => {
      try {
        cb.current(JSON.parse(ev.data));
      } catch {
        /* ignore malformed / keep-alive */
      }
    };
    return () => es.close();
  }, [url, enabled]);
}
