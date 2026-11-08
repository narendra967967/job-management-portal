"use server";

// The unsubscribe page's actions. No session: the signed token from the email
// link is what proves whose messages these are (lib/unsubscribe.ts).

import { z } from "zod";
import { setPromoOptOutByToken } from "@/lib/unsubscribe";

const zToken = z.string().min(10).max(300);

/** Turns promotional messages off for the link's owner. */
export async function unsubscribeAction(token: string): Promise<{ ok: boolean }> {
  if (!zToken.safeParse(token).success) return { ok: false };
  return { ok: await setPromoOptOutByToken(token, true) };
}

/** Undo: turns them back on. */
export async function resubscribeAction(token: string): Promise<{ ok: boolean }> {
  if (!zToken.safeParse(token).success) return { ok: false };
  return { ok: await setPromoOptOutByToken(token, false) };
}
