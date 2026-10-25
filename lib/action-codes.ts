import "server-only";

// One-time email codes that confirm destructive account actions (reset leads,
// request account deletion). 6 digits, valid 10 minutes, 5 tries, a new code
// at most once a minute. Only an HMAC of the code is stored (action_codes).

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { actionCodes } from "@/db/schema";
import { sendAppEmail, SMTP_NOT_CONFIGURED } from "@/lib/email";

export type ActionCodePurpose = "reset_leads" | "delete_account";

const TTL_MS = 10 * 60_000;
const RESEND_MS = 60_000;
export const MAX_CODE_ATTEMPTS = 5;

const COPY: Record<ActionCodePurpose, { subject: string; heading: string; what: string }> = {
  reset_leads: {
    subject: "Your code to reset your leads",
    heading: "Confirm resetting your leads",
    what: "permanently delete all your leads and everything attached to them",
  },
  delete_account: {
    subject: "Your code to request account deletion",
    heading: "Confirm your account deletion request",
    what: "send a request to delete your account and all its data",
  },
};

function hash(userId: string, purpose: ActionCodePurpose, code: string): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set.");
  return createHmac("sha256", secret).update(`${userId}:${purpose}:${code}`).digest("hex");
}

type Result = { ok: true } | { ok: false; error: string };

/** Create (or replace) the user's code for `purpose` and email it to them. */
export async function issueActionCode(
  userId: string,
  email: string,
  purpose: ActionCodePurpose,
): Promise<Result> {
  const [existing] = await db
    .select({ createdAt: actionCodes.createdAt })
    .from(actionCodes)
    .where(and(eq(actionCodes.userId, userId), eq(actionCodes.purpose, purpose)));
  if (existing) {
    const wait = Math.ceil((existing.createdAt.getTime() + RESEND_MS - Date.now()) / 1000);
    if (wait > 0) return { ok: false, error: `Please wait ${wait}s before asking for a new code.` };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = new Date();
  const values = { codeHash: hash(userId, purpose, code), attempts: 0, expiresAt: new Date(now.getTime() + TTL_MS), createdAt: now };
  await db
    .insert(actionCodes)
    .values({ userId, purpose, ...values })
    .onConflictDoUpdate({ target: [actionCodes.userId, actionCodes.purpose], set: values });

  const c = COPY[purpose];
  // Development only: reserved test domains can't receive mail — log the code
  // instead of bouncing an email through the real SMTP account.
  if (process.env.NODE_ENV !== "production" && /\.(test|localhost|example|invalid)$/i.test(email)) {
    console.info(`[action-codes] dev: ${purpose} code for ${email} is ${code}`);
    return { ok: true };
  }
  try {
    await sendAppEmail({
      to: email,
      subject: c.subject,
      heading: c.heading,
      bodyHtml: `<p>Use this code to ${c.what}:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</p>
<p>It expires in 10 minutes. If you didn't ask for this, ignore this email and change your password.</p>`,
      text: `Use this code to ${c.what}: ${code}\n\nIt expires in 10 minutes. If you didn't ask for this, ignore this email and change your password.`,
    });
  } catch (e) {
    await db.delete(actionCodes).where(and(eq(actionCodes.userId, userId), eq(actionCodes.purpose, purpose)));
    if (e instanceof Error && e.message === SMTP_NOT_CONFIGURED) {
      return { ok: false, error: "Email isn't set up yet, so we can't send the code. Please contact support." };
    }
    console.error("[action-codes] send failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "We couldn't send the code. Please try again." };
  }
  return { ok: true };
}

/** Check a code. Success uses it up; each wrong try counts toward the limit. */
export async function verifyActionCode(userId: string, purpose: ActionCodePurpose, code: string): Promise<Result> {
  const where = and(eq(actionCodes.userId, userId), eq(actionCodes.purpose, purpose));
  const [row] = await db.select().from(actionCodes).where(where);
  if (!row || row.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "This code has expired. Send a new one." };
  }
  if (row.attempts >= MAX_CODE_ATTEMPTS) {
    return { ok: false, error: "Too many wrong tries. Send a new code." };
  }
  const clean = code.replace(/\D/g, "");
  const a = Buffer.from(hash(userId, purpose, clean), "hex");
  const b = Buffer.from(row.codeHash, "hex");
  if (clean.length !== 6 || a.length !== b.length || !timingSafeEqual(a, b)) {
    const attempts = row.attempts + 1;
    await db.update(actionCodes).set({ attempts }).where(where);
    const left = MAX_CODE_ATTEMPTS - attempts;
    return { ok: false, error: left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong tries. Send a new code." };
  }
  await db.delete(actionCodes).where(where);
  return { ok: true };
}
