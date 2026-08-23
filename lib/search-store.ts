"use client";

// Shared search query so the top-bar search box drives the Leads list.
// (UI state, not domain data — kept separate from the mock data store.)

import { useSyncExternalStore } from "react";

let query = "";
const listeners = new Set<() => void>();

export function setSearchQuery(q: string) {
  query = q;
  listeners.forEach((l) => l());
}

const get = () => query;
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSearchQuery(): string {
  return useSyncExternalStore(subscribe, get, get);
}
