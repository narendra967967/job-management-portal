"use client";

import { useEffect, useState } from "react";

// PHASE 1: user-tunable follow-up settings, persisted in localStorage so they
// hold across pages. Phase 3 stores these per-user and reads them server-side.

export interface AppSettings {
  /** Days after "Sent" to auto-schedule the follow-up reminder (FR-5.1). */
  reminderIntervalDays: number;
  /** Open leads with no activity for this many days are flagged stale (FR-2.4). */
  staleLeadDays: number;
}

const DEFAULTS: AppSettings = { reminderIntervalDays: 3, staleLeadDays: 14 };
const KEY = "jmp:app-settings";
const EVENT = "jmp:app-settings-changed";

function read(): AppSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

/** Non-hook reads for use outside React (e.g. when marking a message sent). */
export function getReminderIntervalDays(): number {
  return read().reminderIntervalDays;
}
export function getStaleLeadDays(): number {
  return read().staleLeadDays;
}

export function useAppSettings(): [
  AppSettings,
  (patch: Partial<AppSettings>) => void,
] {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);

  useEffect(() => {
    setSettings(read());
    const onChange = (e: Event) =>
      setSettings((e as CustomEvent<AppSettings>).detail);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const update = (patch: Partial<AppSettings>) => {
    const next = { ...read(), ...patch };
    setSettings(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent<AppSettings>(EVENT, { detail: next }));
    }
  };

  return [settings, update];
}
