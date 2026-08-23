"use client";

import { useEffect, useState } from "react";

// Which Gmail messages the ingestion should pull. These map 1:1 to Gmail
// search operators — the sync builds a `q` string and calls
// users.messages.list (READ-ONLY, gmail.readonly). Phase 3 reads these
// server-side; Phase 1 just captures + persists them.

export interface GmailSettings {
  /** From-address allow-list (the sender of your LinkedIn job alerts). */
  senders: string[];
  /** Optional Gmail label to restrict to (if you filter alerts to a label). */
  label: string;
  /** Optional comma-separated words the subject must contain. */
  subjectKeywords: string;
  /** Initial fetch window in days (0 = no limit). Ongoing syncs pull only new. */
  lookbackDays: number;
}

export const DEFAULT_GMAIL_SETTINGS: GmailSettings = {
  // Common LinkedIn job-alert senders — verify against a real alert (open one
  // in Gmail, check its "From" address) and adjust as needed.
  senders: [
    "jobalerts-noreply@linkedin.com",
    "jobs-noreply@linkedin.com",
    "jobs-listings@linkedin.com",
  ],
  label: "",
  subjectKeywords: "",
  lookbackDays: 30,
};

const KEY = "jmp:gmail-settings";
const EVENT = "jmp:gmail-settings-changed";

function read(): GmailSettings {
  if (typeof window === "undefined") return DEFAULT_GMAIL_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw
      ? { ...DEFAULT_GMAIL_SETTINGS, ...JSON.parse(raw) }
      : DEFAULT_GMAIL_SETTINGS;
  } catch {
    return DEFAULT_GMAIL_SETTINGS;
  }
}

/** Build the Gmail search query these settings imply (what the sync runs). */
export function buildGmailQuery(s: GmailSettings): string {
  const parts: string[] = [];

  const senders = s.senders.map((x) => x.trim()).filter(Boolean);
  if (senders.length) {
    parts.push(
      senders.length === 1
        ? `from:${senders[0]}`
        : `{${senders.map((f) => `from:${f}`).join(" ")}}`, // {a b} = OR in Gmail
    );
  }

  if (s.label.trim()) parts.push(`label:${s.label.trim().replace(/\s+/g, "-")}`);

  const kws = s.subjectKeywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (kws.length) {
    parts.push(
      `subject:{${kws.map((k) => (k.includes(" ") ? `"${k}"` : k)).join(" ")}}`,
    );
  }

  if (s.lookbackDays > 0) parts.push(`newer_than:${s.lookbackDays}d`);

  return parts.join(" ") || "in:inbox";
}

export function useGmailSettings(): [
  GmailSettings,
  (patch: Partial<GmailSettings>) => void,
] {
  const [settings, setSettings] = useState<GmailSettings>(
    DEFAULT_GMAIL_SETTINGS,
  );

  useEffect(() => {
    setSettings(read());
    const onChange = (e: Event) =>
      setSettings((e as CustomEvent<GmailSettings>).detail);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const update = (patch: Partial<GmailSettings>) => {
    const next = { ...read(), ...patch };
    setSettings(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent<GmailSettings>(EVENT, { detail: next }));
    }
  };

  return [settings, update];
}
