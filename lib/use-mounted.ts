"use client";

import { useEffect, useState } from "react";

/**
 * False during SSR and the first client render, true after mount. Use it to
 * render locale/time-zone dependent text (dates) only in the browser, so the
 * server's locale can't cause a hydration mismatch.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
