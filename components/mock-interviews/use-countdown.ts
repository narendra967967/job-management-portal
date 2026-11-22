"use client";

import { useEffect, useState } from "react";

/**
 * Seconds left from a figure the server worked out, ticking down each second
 * (a paused interview's time to resume, D13f). The first render uses the
 * figure itself, so the server's HTML and the browser's match. `end` is when
 * it reaches zero by the browser's clock, known once it's running.
 */
export function useCountdown(seconds: number): { left: number; end: number | null } {
  const [left, setLeft] = useState(seconds);
  const [end, setEnd] = useState<number | null>(null);
  useEffect(() => {
    const until = Date.now() + seconds * 1000;
    const tick = () => {
      setLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
      setEnd(until);
    };
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [seconds]);
  return { left, end };
}
