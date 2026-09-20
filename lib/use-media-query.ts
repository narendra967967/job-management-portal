"use client";

import { useEffect, useState } from "react";

/**
 * SSR-safe media-query hook. Starts false on the server / first client render,
 * then resolves in an effect and tracks changes — so a component can mount for
 * exactly one breakpoint instead of rendering both and hiding one with CSS.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    // Fallback: some environments resize the viewport without firing the
    // MediaQueryList "change" event, so re-read on window resize too.
    window.addEventListener("resize", onChange);
    return () => {
      mql.removeEventListener("change", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, [query]);
  return matches;
}

/** True at Tailwind's `lg` breakpoint and up (≥1024px). */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
