"use client";

// PHASE 1 ONLY: sample broadcasts kept in this browser's storage, so the admin
// and user screens can be reviewed end to end before the database exists.
// Nothing is sent: "sending" is worked out from the clock. Phase 2 replaces this
// file with Server Actions; search for "PHASE 1" to find what to remove.
//
// The user side (bell, Notifications page, Settings switch) only shows sample
// broadcasts in development, so real users never see them if this ships early.

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  sendsEmail,
  sendsInApp,
  type Broadcast,
  type BroadcastAudience,
  type BroadcastCategory,
  type BroadcastInput,
  type InboxBroadcast,
} from "@/lib/broadcasts-model";

export const USER_SAMPLES = process.env.NODE_ENV !== "production";

const KEY = "jobtiva.mock.broadcasts.v1";
const ME = "UI Admin";
export const SAMPLE_ADMIN_EMAIL = "ui-admin@jobtiva.test";
/** How fast the pretend email queue goes. */
const EMAIL_MS = 1200;

/** A made-up user base: 48 accounts, 7 deactivated. */
const USERS = { active: 41, expired: 7, unverified: 3, optedOut: 5, optedOutExpired: 1, optedOutUnverified: 1 };

interface State {
  broadcasts: Broadcast[];
  /** The signed-in user's side. */
  read: string[];
  promoOptOut: boolean;
}

const at = (days: number, h = 10, m = 0) => {
  const t = new Date();
  t.setDate(t.getDate() + days);
  t.setHours(h, m, 0, 0);
  return t.toISOString();
};

const html = {
  maintenance:
    "<p>Hi there,</p><p>Jobtiva will be offline for about 30 minutes on <strong>Sunday, November 9</strong>, from 2:00 to 2:30 AM IST, while we move to a faster database.</p><p>Nothing you've saved is affected. Alerts forwarded during the window are held and arrive once we're back.</p><p>Thanks for your patience,<br>The Jobtiva team</p>",
  ats: "<h2>Check your résumé against any job</h2><p>The new <strong>Résumé ATS check</strong> compares your résumé with a job's description and shows the keywords you're missing, before you apply.</p><p>Open any job and choose <em>Check résumé</em> to try it.</p><p><img src=\"https://placehold.co/560x220/eef2ff/4f46e5?text=Résumé+ATS+check\" alt=\"The Résumé ATS check panel\"></p>",
  privacy:
    "<p>We've updated our Privacy Policy to explain how forwarded job alerts are stored and for how long.</p><p>The changes take effect on <strong>December 1, 2026</strong>. You can read the full policy at any time from the link at the bottom of every page.</p>",
  tips: "<p>Recruiters reply more often to short, specific messages. Three things that help:</p><ul><li>Name the role and where you saw it.</li><li>Say one thing you did that matches the job.</li><li>Ask one clear question.</li></ul><p>Jobtiva's outreach drafts follow this shape, so start from one and make it yours.</p>",
  webinar: "<p>Join us for a 30-minute walkthrough of email forwarding, with time for questions.</p>",
};

const base = (b: Partial<Broadcast> & Pick<Broadcast, "id" | "title" | "contentHtml" | "category" | "channel" | "status">): Broadcast => ({
  scheduledFor: null,
  createdAt: at(-10),
  updatedAt: at(-10),
  createdBy: ME,
  startedAt: null,
  finishedAt: null,
  canceledAt: null,
  delivery: null,
  ...b,
});

const SAMPLE: State = {
  read: ["b-ats"],
  promoOptOut: false,
  broadcasts: [
    base({ id: "b-tips", title: "Three ways to get more replies from recruiters", contentHtml: html.tips, category: "promotional", channel: "both", status: "draft", updatedAt: at(0, 9, 15) }),
    base({ id: "b-privacy", title: "We're updating our Privacy Policy", contentHtml: html.privacy, category: "important", channel: "both", status: "scheduled", scheduledFor: at(2, 10), updatedAt: at(-1, 16) }),
    base({
      id: "b-maint",
      title: "Jobtiva will be offline for 30 minutes on Sunday",
      contentHtml: html.maintenance,
      category: "important",
      channel: "both",
      status: "sent",
      createdAt: at(-3, 9),
      updatedAt: at(-3, 9),
      startedAt: at(-3, 9, 5),
      finishedAt: at(-3, 9, 6),
      delivery: { inApp: 41, emailTotal: 38, emailSent: 37, emailFailed: 1 },
    }),
    base({
      id: "b-ats",
      title: "New: check your résumé against any job",
      contentHtml: html.ats,
      category: "promotional",
      channel: "both",
      status: "sent",
      createdAt: at(-8, 11),
      updatedAt: at(-8, 11),
      startedAt: at(-8, 11, 30),
      finishedAt: at(-8, 11, 31),
      delivery: { inApp: 36, emailTotal: 34, emailSent: 34, emailFailed: 0 },
    }),
    base({ id: "b-webinar", title: "Live walkthrough: email forwarding", contentHtml: html.webinar, category: "promotional", channel: "email", status: "canceled", scheduledFor: at(-5, 18), canceledAt: at(-6, 12), updatedAt: at(-6, 12) }),
  ],
};

let state: State = SAMPLE;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...SAMPLE, ...JSON.parse(raw) };
  } catch {
    // Unreadable or blocked storage: keep the sample.
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

const getSnapshot = () => {
  load();
  return state;
};
const getServerSnapshot = () => SAMPLE;

function useState_(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** The current time, ticking, for screens that show live progress. */
export function useNow(everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

/* ---------------- audience ---------------- */

export function sampleAudience(category: BroadcastCategory): BroadcastAudience {
  const promo = category === "promotional";
  const recipients = USERS.active - (promo ? USERS.optedOut : 0);
  return {
    inApp: recipients,
    email: recipients - (USERS.unverified - (promo ? USERS.optedOutUnverified : 0)),
    expired: USERS.expired - (promo ? USERS.optedOutExpired : 0),
    unverified: USERS.unverified - (promo ? USERS.optedOutUnverified : 0),
    optedOut: promo ? USERS.optedOut : 0,
  };
}

/* ---------------- admin side ---------------- */

/** A broadcast as of `now`: a due scheduled send has started, and the pretend queue moves on. */
export function resolveBroadcast(b: Broadcast, now: number): Broadcast {
  let r = b;
  if (r.status === "scheduled" && r.scheduledFor && new Date(r.scheduledFor).getTime() <= now) {
    r = start(r, r.scheduledFor);
  }
  if (r.status !== "sending" || !r.delivery || !r.startedAt) return r;
  const done = Math.min(r.delivery.emailTotal, Math.floor((now - new Date(r.startedAt).getTime()) / EMAIL_MS));
  // One sample failure, so the progress screen shows what that looks like.
  const failed = r.delivery.emailTotal > 10 && done > 8 ? 1 : 0;
  const delivery = { ...r.delivery, emailSent: done - failed, emailFailed: failed };
  if (done < r.delivery.emailTotal) return { ...r, delivery };
  const finishedAt = new Date(new Date(r.startedAt).getTime() + r.delivery.emailTotal * EMAIL_MS).toISOString();
  return { ...r, status: "sent", finishedAt, delivery };
}

function start(b: Broadcast, when: string): Broadcast {
  const a = sampleAudience(b.category);
  return {
    ...b,
    status: "sending",
    startedAt: when,
    delivery: {
      inApp: sendsInApp(b.channel) ? a.inApp : 0,
      emailTotal: sendsEmail(b.channel) ? a.email : 0,
      emailSent: 0,
      emailFailed: 0,
    },
  };
}

export function useBroadcasts(): Broadcast[] {
  return useState_().broadcasts;
}

export function useBroadcast(id: string): Broadcast | undefined {
  return useState_().broadcasts.find((b) => b.id === id);
}

const newId = () => `b-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Saves a draft, or sends or schedules it (`scheduledFor` set). Only drafts and
 * scheduled sends that haven't started can change.
 */
export function saveBroadcast(id: string | null, input: BroadcastInput, mode: "draft" | "send"): string {
  const now = new Date().toISOString();
  const existing = id ? state.broadcasts.find((b) => b.id === id) : undefined;
  let b: Broadcast = {
    ...(existing ?? base({ id: newId(), title: "", contentHtml: "", category: "important", channel: "both", status: "draft", createdAt: now })),
    ...input,
    updatedAt: now,
    status: mode === "draft" ? "draft" : input.scheduledFor ? "scheduled" : "draft",
  };
  if (mode === "send" && !input.scheduledFor) b = start(b, now);
  commit({ ...state, broadcasts: existing ? state.broadcasts.map((x) => (x.id === b.id ? b : x)) : [b, ...state.broadcasts] });
  return b.id;
}

/** Stops a scheduled send, or the rest of one that's going out. */
export function cancelBroadcast(id: string) {
  const now = Date.now();
  commit({
    ...state,
    broadcasts: state.broadcasts.map((x) => {
      if (x.id !== id) return x;
      const r = resolveBroadcast(x, now);
      if (r.status !== "scheduled" && r.status !== "sending") return x;
      return { ...r, status: "canceled", canceledAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString() };
    }),
  });
}

export function deleteBroadcast(id: string) {
  commit({ ...state, broadcasts: state.broadcasts.filter((b) => b.id !== id || !["draft", "canceled"].includes(b.status)) });
}

/** A new draft with the same content, for resending or reusing a message. */
export function duplicateBroadcast(id: string): string | null {
  const src = state.broadcasts.find((b) => b.id === id);
  if (!src) return null;
  const now = new Date().toISOString();
  const copy = base({ id: newId(), title: `${src.title} (copy)`.slice(0, 120), contentHtml: src.contentHtml, category: src.category, channel: src.channel, status: "draft", createdAt: now, updatedAt: now });
  commit({ ...state, broadcasts: [copy, ...state.broadcasts] });
  return copy.id;
}

/* ---------------- user side ---------------- */

/** Broadcasts that reached this user in the app, newest first. */
export function useInbox(): InboxBroadcast[] {
  const s = useState_();
  const now = useNow(5000);
  if (!USER_SAMPLES) return [];
  return s.broadcasts
    .map((b) => resolveBroadcast(b, now))
    .filter((b) => (b.status === "sending" || b.status === "sent" || (b.status === "canceled" && b.startedAt)) && sendsInApp(b.channel))
    .filter((b) => !(b.category === "promotional" && s.promoOptOut))
    .sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""))
    .map((b) => ({
      id: `bc-${b.id}`,
      broadcastId: b.id,
      title: b.title,
      contentHtml: b.contentHtml,
      category: b.category,
      at: b.startedAt ?? b.updatedAt,
      read: s.read.includes(b.id),
    }));
}

export function markInboxRead(broadcastIds: string[]) {
  const fresh = broadcastIds.filter((id) => !state.read.includes(id));
  if (fresh.length) commit({ ...state, read: [...state.read, ...fresh] });
}

export function usePromoOptOut(): boolean {
  return useState_().promoOptOut;
}

export function setPromoOptOut(optOut: boolean) {
  commit({ ...state, promoOptOut: optOut });
}
