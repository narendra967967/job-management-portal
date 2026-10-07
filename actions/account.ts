"use server";

// Account Server Actions for the user side. Currently: a deactivated user asking
// an admin to reactivate them (emails the admin with their details + message).

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, accessState } from "@/lib/current-user";
import { appSettings, user } from "@/db/schema";
import { sendAppEmail, SMTP_NOT_CONFIGURED } from "@/lib/email";
import { createSupportTicket } from "@/lib/tickets";

const schema = z.object({
  message: z.string().trim().min(1, "Write a short message.").max(5000),
  html: z.string().max(20000).optional(),
});

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function adminRecipient(): Promise<string | null> {
  const [settings] = await db.select({ email: appSettings.supportEmail }).from(appSettings).limit(1);
  if (settings?.email) return settings.email;
  const [admin] = await db.select({ email: user.email }).from(user).where(eq(user.role, "admin")).limit(1);
  return admin?.email ?? null;
}

export async function requestReactivationAction(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const u = await getSessionUser();
  if (!u) return { ok: false, error: "You're not signed in." };
  if (accessState(u) !== "deactivated") return { ok: false, error: "Your account isn't deactivated." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid message." };

  const to = await adminRecipient();
  if (!to) return { ok: false, error: "No admin contact is set up yet. Please try again later." };

  // The rich-text HTML is the user's own message; it's emailed, not rendered in the
  // app. Fall back to the escaped plain text when empty.
  const bodyHtml = parsed.data.html?.trim() || `<p>${esc(parsed.data.message)}</p>`;
  const subject = `Reactivation request — ${u.name || u.email}`;
  const detailsHtml = `
    <p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#374151;"><strong>${esc(u.name)}</strong> has requested their account be reactivated.</p>
    <table cellpadding="4" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#374151">
      <tr><td><strong>Name</strong></td><td>${esc(u.name)}</td></tr>
      <tr><td><strong>Email</strong></td><td>${esc(u.email)}</td></tr>
      <tr><td><strong>Mobile</strong></td><td>${esc(u.mobile ?? "—")}</td></tr>
      <tr><td><strong>User ID</strong></td><td>${esc(u.id)}</td></tr>
      <tr><td><strong>Requested</strong></td><td>${esc(new Date().toISOString())}</td></tr>
    </table>
    <p style="margin:16px 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827"><strong>Message</strong></p>
    ${bodyHtml}
  `;
  const text = `${u.name} (${u.email}) requests account reactivation.\n\n${parsed.data.message}`;

  // Record it as a support ticket for the admin Tickets inbox (best-effort — the
  // email below is the primary notification).
  try {
    await createSupportTicket({
      userId: u.id,
      name: u.name,
      email: u.email,
      subject,
      // Prefer the rich-text HTML (sanitized on write); fall back to the plain text.
      message: parsed.data.html?.trim() || parsed.data.message,
      source: "reactivation",
    });
  } catch (e) {
    console.error("[account] ticket create failed:", e instanceof Error ? e.message : String(e));
  }

  try {
    await sendAppEmail({ to, subject, heading: "Account reactivation request", bodyHtml: detailsHtml, text });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === SMTP_NOT_CONFIGURED) {
      return { ok: false, error: "Email isn't set up yet — please reach the admin another way." };
    }
    return { ok: false, error: "Couldn't send right now. Please try again later." };
  }
}
