"use client";

import { useEffect, useState } from "react";
import { getDefaultResumeId } from "@/lib/mock-data";

// PHASE 1: the default-resume choice is shared across pages via localStorage +
// a window event so Settings and the Leads grid stay in sync without a backend.
// Phase 3 persists this per-user and reads it in a Server Action instead.

const KEY = "jmp:default-resume-id";
const EVENT = "jmp:default-resume-changed";

function read(): string {
  if (typeof window === "undefined") return getDefaultResumeId();
  return window.localStorage.getItem(KEY) ?? getDefaultResumeId();
}

export function useDefaultResumeId(): [string, (id: string) => void] {
  // Start from the seeded default for a stable SSR/first paint, then hydrate
  // from localStorage on mount to avoid a hydration mismatch.
  const [id, setId] = useState<string>(getDefaultResumeId());

  useEffect(() => {
    setId(read());
    const onChange = (e: Event) => setId((e as CustomEvent<string>).detail);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const update = (next: string) => {
    setId(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, next);
      window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: next }));
    }
  };

  return [id, update];
}
