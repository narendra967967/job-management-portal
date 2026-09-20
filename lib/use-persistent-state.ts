"use client";

// Small SSR-safe persisted-state hook backed by localStorage or sessionStorage.
// - localStorage: survives reload AND logout→login (view mode, board columns).
// - sessionStorage: survives reload but is cleared on logout (filters), so a
//   fresh login starts clean. Logout clears the session keys explicitly.

import { useEffect, useState } from "react";

type StoreKind = "local" | "session";

// Persisted keys, centralised so logout can clear the right ones.
export const PERSIST_KEYS = {
  leadsView: "jmp.leads.view", // local
  kanbanColumns: "jmp.kanban.columns", // local
  leadsFilters: "jmp.leads.filters", // session (reset on logout)
} as const;

// Session-scoped state is wiped on logout. Filters live under this prefix:
// - "jmp.leads.filters"       (Kanban)
// - "jmp.leadsBrowser.<scope>" (list view, per scope)
const SESSION_KEY_PREFIX = "jmp.leads";

function getStore(kind: StoreKind): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Clear session-scoped persisted state (call on logout). */
export function clearSessionPersistedState() {
  const s = getStore("session");
  if (!s) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(SESSION_KEY_PREFIX)) keys.push(k);
    }
    for (const k of keys) s.removeItem(k);
  } catch {
    /* ignore */
  }
}

export function usePersistentState<T>(
  key: string,
  initial: T,
  kind: StoreKind = "local",
) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  // Hydrate from storage once on mount (avoids SSR hydration mismatch).
  useEffect(() => {
    const s = getStore(kind);
    let next = initial;
    if (s) {
      try {
        const raw = s.getItem(key);
        if (raw != null) next = JSON.parse(raw) as T;
      } catch {
        /* ignore corrupt value */
      }
    }
    setValue(next);
    setLoaded(true);
    // Only re-run if the key/kind change (they don't in practice).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, kind]);

  // Persist on change, but not before we've hydrated (so the default doesn't
  // clobber a stored value on first mount).
  useEffect(() => {
    if (!loaded) return;
    const s = getStore(kind);
    if (!s) return;
    try {
      s.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota/private-mode errors */
    }
  }, [key, kind, value, loaded]);

  return [value, setValue] as const;
}
