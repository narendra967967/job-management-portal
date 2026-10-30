"use server";

// Settings → Account → Request account deletion. The user explains (optional),
// confirms with an emailed code, and a support ticket in category "deletion"
// reaches the admin's Tickets inbox. The account stays usable until the admin
// deletes it; the user can cancel meanwhile. See lib/account-deletion.ts.

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/current-user";
import { supportTickets, ticketReplies } from "@/db/schema";
import { issueActionCode, verifyActionCode } from "@/lib/action-codes";
import { createSupportTicket } from "@/lib/tickets";
import { sendAppEmail } from "@/lib/email";
import { ticketRef } from "@/lib/tickets-model";
import { DELETION_CATEGORY, DELETION_SOURCE, openDeletionRequest } from "@/lib/account-deletion";

type Result = { ok: true } | { ok: false; error: string };

async function me() {
  const u = await getSessionUser();
  if (!u) throw new Error("Please sign in again.");
  return u;
}

export interface DeletionRequestState {
  requestedAt: string;
  ref: string;
}

export async function getDeletionRequestAction(): Promise<DeletionRequestState | null> {
  const u = await me();
  const t = await openDeletionRequest(u.id);
  return t ? { requestedAt: t.createdAt.toISOString(), ref: ticketRef(t.number) } : null;
}

export async function sendDeletionCodeAction(): Promise<Result> {
  const u = await me();
  if (await openDeletionRequest(u.id)) return { ok: false, error: "You've already asked for your account to be deleted." };
  return issueActionCode(u.id, u.email, "delete_account");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const reasonSchema = z.string().trim().max(1000, "Keep the reason under 1,000 characters.");

export async function requestDeletionAction(code: unknown, reason: unknown): Promise<Result> {
  const u = await me();
  const r = reasonSchema.safeParse(typeof reason === "string" ? reason : "");
  if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? "Invalid reason." };
  if (typeof code !== "string") return { ok: false, error: "Enter the code from the email." };
  if (await openDeletionRequest(u.id)) return { ok: false, error: "You've already asked for your account to be deleted." };
  const v = await verifyActionCode(u.id, "delete_account", code);
  if (!v.ok) return v;

  const id = await createSupportTicket({
    userId: u.id,
    name: u.name,
    email: u.email,
    subject: "Account deletion request",
    message: `<p>Please delete my account and all its data.</p><p><strong>Reason:</strong> ${r.data ? esc(r.data) : "(none given)"}</p>`,
    category: DELETION_CATEGORY,
    source: DELETION_SOURCE,
  });
  const [t] = await db.select({ number: supportTickets.number }).from(supportTickets).where(eq(supportTickets.id, id));

  sendAppEmail({
    to: u.email,
    subject: "We've received your account deletion request",
    heading: "Deletion request received",
    lines: [
      `We've received your request to delete your account (${t ? ticketRef(t.number) : "support ticket"}).`,
      "Our team will delete your account and all its data, and email you when it's done. Until then you can keep using it.",
      "Changed your mind? Cancel the request in Settings → Account.",
    ],
  }).catch((e) => console.error("[account-deletion] receipt email failed:", e instanceof Error ? e.message : e));

  revalidatePath("/settings");
  return { ok: true };
}

export async function cancelDeletionRequestAction(): Promise<Result> {
  const u = await me();
  const t = await openDeletionRequest(u.id);
  if (!t) return { ok: false, error: "There's no deletion request to cancel." };
  await db.transaction(async (tx) => {
    await tx.insert(ticketReplies).values({ ticketId: t.id, author: "user", body: "<p>I've canceled my account deletion request.</p>" });
    await tx
      .update(supportTickets)
      .set({ status: "resolved", cancelledAt: new Date(), subject: "Account deletion request (canceled by user)" })
      .where(eq(supportTickets.id, t.id));
  });

  sendAppEmail({
    to: u.email,
    subject: "Thanks for staying with us",
    heading: "Thanks for staying",
    lines: [
      `Hi ${u.name || "there"}, you've canceled your account deletion request (${ticketRef(t.number)}) — your account and all your data stay exactly as they are.`,
      "We're glad you're staying. If something wasn't working for you, just reply from Help & support — we'd love to make it better.",
    ],
  }).catch((e) => console.error("[account-deletion] thank-you email failed:", e instanceof Error ? e.message : e));

  revalidatePath("/settings");
  return { ok: true };
}
