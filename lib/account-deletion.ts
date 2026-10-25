import "server-only";

// Account deletion. Users ask from Settings → Account (confirmed by an emailed
// code); the request is a support ticket in category "deletion" that the admin
// acts on from Tickets or Users. deleteUserCompletely() is the ONE way an account
// is removed — admin single + bulk delete both go through it.
//
// What a deletion removes:
//  - every app row of the user (FK cascades from `user`: leads and all their
//    children, contacts, résumés + file bytes in the DB, career profile, notes,
//    settings, forwarding address, email log, AI queue, sessions, logins…);
//  - résumé files on disk (local storage isn't covered by the cascade);
//  - the user's support tickets — except a deletion-request ticket, which is
//    kept anonymised as the record that the request was handled.

import { and, desc, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { resumes, supportTickets, ticketReplies, user } from "@/db/schema";
import { deleteResumeFile } from "@/lib/storage";
import { sendAppEmail } from "@/lib/email";

export const DELETION_CATEGORY = "deletion";
export const DELETION_SOURCE = "account-deletion";

/** The user's open deletion request (not resolved, not cancelled), if any. */
export async function openDeletionRequest(userId: string) {
  const [t] = await db
    .select({ id: supportTickets.id, number: supportTickets.number, createdAt: supportTickets.createdAt })
    .from(supportTickets)
    .where(
      and(
        eq(supportTickets.userId, userId),
        eq(supportTickets.category, DELETION_CATEGORY),
        ne(supportTickets.status, "resolved"),
        isNull(supportTickets.cancelledAt),
      ),
    );
  return t ?? null;
}

/** When the user last cancelled a deletion request (null = never). */
export async function lastCancelledDeletion(userId: string): Promise<Date | null> {
  const [t] = await db
    .select({ at: supportTickets.cancelledAt })
    .from(supportTickets)
    .where(
      and(
        eq(supportTickets.userId, userId),
        eq(supportTickets.category, DELETION_CATEGORY),
        isNotNull(supportTickets.cancelledAt),
      ),
    )
    .orderBy(desc(supportTickets.cancelledAt))
    .limit(1);
  return t?.at ?? null;
}

export const fmtDay = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Remove the account and everything in it. Irreversible. */
export async function deleteUserCompletely(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const [u] = await db.select({ email: user.email, name: user.name }).from(user).where(eq(user.id, userId));
  if (!u) return { ok: false, error: "User not found." };

  const [files, tickets, requested] = await Promise.all([
    db.select({ blobUrl: resumes.blobUrl }).from(resumes).where(eq(resumes.userId, userId)),
    db.select({ id: supportTickets.id, category: supportTickets.category }).from(supportTickets).where(eq(supportTickets.userId, userId)),
    openDeletionRequest(userId),
  ]);
  const keep = tickets.filter((t) => t.category === DELETION_CATEGORY).map((t) => t.id);
  const drop = tickets.filter((t) => t.category !== DELETION_CATEGORY).map((t) => t.id);
  const when = fmtDay(new Date());

  await db.transaction(async (tx) => {
    if (drop.length) await tx.delete(supportTickets).where(inArray(supportTickets.id, drop)); // replies cascade
    if (keep.length) {
      await tx.delete(ticketReplies).where(inArray(ticketReplies.ticketId, keep));
      await tx
        .update(supportTickets)
        .set({
          name: "Deleted user",
          email: "",
          message: `<p>Account and all its data deleted on ${when}.</p>`,
          status: "resolved",
        })
        .where(inArray(supportTickets.id, keep));
    }
    await tx.delete(user).where(eq(user.id, userId)); // cascades all app data
  });

  // Files on disk aren't part of the DB cascade. Best effort — the account is gone.
  await Promise.all(files.map((f) => deleteResumeFile(f.blobUrl)));

  // Final confirmation, for users who asked to be deleted.
  if (requested) {
    sendAppEmail({
      to: u.email,
      subject: "Your account has been deleted",
      heading: "Your account has been deleted",
      lines: [
        `Hi ${u.name || "there"}, as you asked, we've permanently deleted your account and all its data — leads, contacts, résumés, profile and settings.`,
        "This can't be undone. You're welcome to sign up again any time.",
      ],
    }).catch((e) => console.error("[account-deletion] final email failed:", e instanceof Error ? e.message : e));
  }
  return { ok: true };
}
