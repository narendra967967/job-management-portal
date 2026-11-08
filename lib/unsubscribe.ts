import "server-only";

// One-click unsubscribe from promotional messages, without signing in. Every
// promotional email carries a link with a token signed by the app's secret
// and tied to one user, so it can only ever unsubscribe that user. Tokens
// don't expire: an unsubscribe link has to keep working for months.
//
// Two ways in:
// - Mail apps' own "Unsubscribe" button POSTs to /api/unsubscribe (RFC 8058).
// - The link in the email body opens /unsubscribe, whose page unsubscribes
//   from the browser once it loads. Email security scanners that open every
//   link only fetch the HTML, so they can't unsubscribe anyone by accident.

import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user, userSettings } from "@/db/schema";
import { getAppBaseUrl } from "@/lib/branding";

const PURPOSE = "jobtiva:unsubscribe-promo:v1";

function key(): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
  // Its own key, so these signatures can't be swapped with any other the app makes.
  return createHmac("sha256", secret).update(PURPOSE).digest();
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sign = (userId: string) => createHmac("sha256", key()).update(userId).digest().subarray(0, 24);

export function unsubscribeToken(userId: string): string {
  return `${b64(userId)}.${b64(sign(userId))}`;
}

/** The user a token belongs to, or null when it's malformed or not ours. */
export function verifyUnsubscribeToken(token: string | null | undefined): string | null {
  if (!token || token.length > 300) return null;
  const [idPart, sigPart, extra] = token.split(".");
  if (!idPart || !sigPart || extra !== undefined) return null;
  let userId: string;
  let given: Buffer;
  try {
    userId = Buffer.from(idPart, "base64url").toString("utf8");
    given = Buffer.from(sigPart, "base64url");
  } catch {
    return null;
  }
  if (!userId || /[^\w-]/.test(userId)) return null;
  const expected = sign(userId);
  return given.length === expected.length && timingSafeEqual(given, expected) ? userId : null;
}

/** The page link for an email body. */
export function unsubscribePageUrl(userId: string): string {
  return `${getAppBaseUrl()}/unsubscribe?t=${unsubscribeToken(userId)}`;
}

/** Headers that give mail apps their own one-click Unsubscribe button. */
export function unsubscribeHeaders(userId: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${getAppBaseUrl()}/api/unsubscribe?t=${unsubscribeToken(userId)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** Turns promotional messages off (or back on) for the token's user. False when the token is no good. */
export async function setPromoOptOutByToken(token: string, optOut: boolean): Promise<boolean> {
  const userId = verifyUnsubscribeToken(token);
  if (!userId) return false;
  const [u] = await db.select({ id: user.id }).from(user).where(eq(user.id, userId));
  if (!u) return false;
  const set = { promoOptOut: optOut, promoOptOutAt: optOut ? new Date() : null };
  await db.insert(userSettings).values({ userId, ...set }).onConflictDoUpdate({ target: userSettings.userId, set });
  return true;
}
