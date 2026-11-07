"use client";

// Menu clicks open pages fresh: every filter cleared (owner rule, 2026-11-07).
// A reload still keeps filters (that's what the session-saved filters are
// for); only a click on a menu item starts clean.
//
// freshNavigation(href) — call from a menu link's onClick. It clears the
//   session-saved list filters and the top-bar search. If the link points at
//   the page already open, it also bumps a counter that <FreshPage> keys on,
//   so the page remounts with default state (otherwise a same-page click would
//   keep the filters in component state).
// <FreshPage> — wraps the page content in the user and admin layouts.

import { Fragment, useSyncExternalStore } from "react";
import { clearSessionPersistedState } from "@/lib/use-persistent-state";
import { setSearchQuery } from "@/lib/search-store";

let nonce = 0;
const listeners = new Set<() => void>();

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const getNonce = () => nonce;

export function freshNavigation(href: string) {
  clearSessionPersistedState();
  setSearchQuery("");
  const path = href.split(/[?#]/)[0];
  if (typeof window !== "undefined" && path === window.location.pathname) {
    nonce += 1;
    listeners.forEach((l) => l());
  }
}

export function FreshPage({ children }: { children: React.ReactNode }) {
  const key = useSyncExternalStore(subscribe, getNonce, getNonce);
  return <Fragment key={key}>{children}</Fragment>;
}
