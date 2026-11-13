"use client";

// Filters in the address bar for admin list pages. A page reads its filters
// from the link once, when it opens (so a dashboard number can open the list
// already filtered), then writes them back as the admin changes them, so the
// filtered list can be bookmarked or shared. Writing uses history.replaceState,
// which Next keeps in sync with useSearchParams without a server round trip.

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Values = Record<string, string | null | undefined>;

/** Replace these query keys in the current URL; empty values are removed. */
export function replaceQuery(values: Values) {
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(values)) {
    if (v) url.searchParams.set(k, v);
    else url.searchParams.delete(k);
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    window.history.replaceState(window.history.state, "", next);
  }
}

/** Keep the URL in step with a page's filters. Default values are left out of the URL. */
export function useQuerySync(values: Values, defaults: Values = {}) {
  const key = JSON.stringify(values);
  useEffect(() => {
    const out: Values = {};
    for (const [k, v] of Object.entries(values)) out[k] = v && v !== defaults[k] ? v : null;
    replaceQuery(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/**
 * The page's query params as they were when it opened. Later changes made by
 * useQuerySync don't feed back into state.
 */
export function useInitialQuery(): URLSearchParams {
  const params = useSearchParams();
  const [initial] = useState(() => new URLSearchParams(params.toString()));
  return initial;
}

/** A query value if it's one of the allowed ones, else the fallback. */
export function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A YYYY-MM-DD query value, or "" when it's missing or malformed. */
export function dateParam(value: string | null): string {
  return value && DATE_RE.test(value) ? value : "";
}

/** "Oct 16 to Nov 14, 2026" for a pair of YYYY-MM-DD dates. */
export function rangeLabel(from: string, to: string): string {
  const f = (s: string, year: boolean) =>
    new Date(`${s}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}) });
  if (from && to) return from === to ? f(from, true) : `${f(from, from.slice(0, 4) !== to.slice(0, 4))} to ${f(to, true)}`;
  if (from) return `from ${f(from, true)}`;
  if (to) return `until ${f(to, true)}`;
  return "";
}
