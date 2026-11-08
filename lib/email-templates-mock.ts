"use client";

// PHASE 1 ONLY: edited email templates kept in this browser's storage, so the
// screens can be reviewed before the database exists. Nothing here changes a
// real email: the senders still use their built-in wording. Phase 2 replaces
// this file with Server Actions; search for "PHASE 1" to find what to remove.

import { useSyncExternalStore } from "react";
import {
  EMAIL_TEMPLATES,
  TEMPLATE_VERSIONS_KEPT,
  sameContent,
  templateByKey,
  type EmailTemplateContent,
  type EmailTemplateDef,
} from "@/lib/email-templates-model";

const KEY = "jobtiva.mock.email-templates.v1";
const ME = "UI Admin";

export interface TemplateVersion {
  content: EmailTemplateContent;
  savedAt: string;
  savedBy: string;
}

interface Saved {
  content: EmailTemplateContent;
  updatedAt: string;
  updatedBy: string;
  /** Newest first, at most TEMPLATE_VERSIONS_KEPT. */
  versions: TemplateVersion[];
}

type State = Record<string, Saved>;

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

/** Two samples, so the list shows edited and default rows. */
function sample(): State {
  const reset = templateByKey("reset_password")!;
  const ticket = templateByKey("ticket_received")!;
  return {
    reset_password: {
      content: { ...reset.defaults, footerNote: "Didn't ask for this? Ignore this email and your password stays the same." },
      updatedAt: daysAgo(2),
      updatedBy: ME,
      versions: [{ content: reset.defaults, savedAt: daysAgo(9), savedBy: ME }],
    },
    ticket_received: {
      content: { ...ticket.defaults, heading: "We've got your message" },
      updatedAt: daysAgo(5),
      updatedBy: ME,
      versions: [],
    },
  };
}

let state: State = {};
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    state = raw ? JSON.parse(raw) : sample();
  } catch {
    state = sample();
  }
}

function commit(next: State) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode etc.: changes last until reload.
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  load();
  listeners.add(l);
  return () => listeners.delete(l);
}

const EMPTY: State = {};
const getSnapshot = () => {
  load();
  return state;
};

export interface TemplateRow {
  def: EmailTemplateDef;
  content: EmailTemplateContent;
  edited: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  versions: TemplateVersion[];
}

function row(def: EmailTemplateDef, s: State): TemplateRow {
  const saved = s[def.key];
  return {
    def,
    content: saved?.content ?? def.defaults,
    // Edited means the wording differs from the built-in default, not just "was saved".
    edited: !!saved && !sameContent(saved.content, def.defaults),
    updatedAt: saved?.updatedAt ?? null,
    updatedBy: saved?.updatedBy ?? null,
    versions: saved?.versions ?? [],
  };
}

export function useTemplateRows(): TemplateRow[] {
  const s = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  return EMAIL_TEMPLATES.map((def) => row(def, s));
}

export function useTemplateRow(key: string): TemplateRow | null {
  const s = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  const def = templateByKey(key);
  return def ? row(def, s) : null;
}

/** Saves new wording; what it replaces becomes a version (newest 5 kept). */
export function saveTemplate(key: string, content: EmailTemplateContent) {
  const def = templateByKey(key);
  if (!def) return;
  const prev = state[key];
  const before = prev?.content ?? def.defaults;
  const versions = [
    { content: before, savedAt: prev?.updatedAt ?? new Date().toISOString(), savedBy: prev?.updatedBy ?? "Built-in default" },
    ...(prev?.versions ?? []),
  ].slice(0, TEMPLATE_VERSIONS_KEPT);
  commit({ ...state, [key]: { content, updatedAt: new Date().toISOString(), updatedBy: ME, versions } });
}

/** Back to the built-in wording. The edited wording is kept as a version. */
export function resetTemplate(key: string) {
  const def = templateByKey(key);
  const prev = state[key];
  if (!def || !prev) return;
  const versions = [{ content: prev.content, savedAt: prev.updatedAt, savedBy: prev.updatedBy }, ...prev.versions].slice(
    0,
    TEMPLATE_VERSIONS_KEPT,
  );
  // Default wording, but the history stays so a reset can be undone.
  commit({ ...state, [key]: { content: def.defaults, updatedAt: new Date().toISOString(), updatedBy: ME, versions } });
}
