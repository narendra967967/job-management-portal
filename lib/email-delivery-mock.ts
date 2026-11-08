"use client";

// PHASE 1 ONLY: the chosen email service and the Amazon SES details kept in this
// browser's storage, so the screen can be reviewed before the database exists.
// Nothing here changes how email is sent: the mailer still uses SMTP. Phase 2
// replaces this file with Server Actions; search for "PHASE 1" to find what to remove.

import { useSyncExternalStore } from "react";
import type { EmailProvider, SesAccountInfo, SesInput, SesSettings } from "@/lib/email-delivery-model";

const KEY = "jobtiva.mock.email-delivery.v1";

interface State {
  provider: EmailProvider;
  ses: SesSettings;
}

const EMPTY_SES: SesSettings = {
  region: "",
  accessKeyId: "",
  hasSecret: false,
  fromName: "",
  fromEmail: "",
  replyTo: "",
  lastTestAt: null,
  lastTestOk: null,
  account: null,
};

const INITIAL: State = { provider: "smtp", ses: EMPTY_SES };

let state: State = INITIAL;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...INITIAL, ...JSON.parse(raw) };
  } catch {
    state = INITIAL;
  }
}

function commit(next: State) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode: lasts until reload.
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  load();
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useEmailDelivery(): State | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      load();
      return state;
    },
    () => null,
  );
}

const wait = (ms = 500) => new Promise((r) => setTimeout(r, ms));
type Result = { ok: true } | { ok: false; error: string };

export async function saveSes(input: SesInput): Promise<Result> {
  await wait();
  commit({
    ...state,
    ses: {
      ...state.ses,
      region: input.region.trim(),
      accessKeyId: input.accessKeyId.trim(),
      hasSecret: state.ses.hasSecret || !!input.secretAccessKey.trim(),
      fromName: input.fromName.trim(),
      fromEmail: input.fromEmail.trim(),
      replyTo: input.replyTo.trim(),
    },
  });
  return { ok: true };
}

export async function setProvider(provider: EmailProvider): Promise<Result> {
  await wait();
  commit({ ...state, provider });
  return { ok: true };
}

/** Sample answer: a new account still in the sandbox. */
export async function testSes(): Promise<{ ok: true; account: SesAccountInfo } | { ok: false; error: string }> {
  await wait(900);
  const account: SesAccountInfo = { productionAccess: false, sendingEnabled: true, max24HourSend: 200, sentLast24Hours: 3, maxSendRate: 1 };
  commit({ ...state, ses: { ...state.ses, lastTestAt: new Date().toISOString(), lastTestOk: true, account } });
  return { ok: true, account };
}

export async function sendSesTest(to: string): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  await wait(900);
  return { ok: true, to };
}
