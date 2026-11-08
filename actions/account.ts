"use server";

// Account Server Actions for the user side. Currently: a deactivated user asking
// an admin to reactivate them (emails the admin with their details + message).

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, accessState } from "@/lib/current-user";
import { appSettings, user } from "@/db/schema";
import { SMTP_NOT_CONFIGURED } from "@/lib/email";
import { sendTemplateEmail } from "@/lib/email-templates";
import { sanitizeRichText } from "@/lib/sanitize";
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

  // The user's own rich text, cleaned before it goes into the email; the
  // escaped plain text when there's none.
  const bodyHtml = (parsed.data.html?.trim() && sanitizeRichText(parsed.data.html)) || `<p>${esc(parsed.data.message)}</p>`;
  const subject = `Reactivation request: ${u.name || u.email}`;
  const cell = "padding:4px 12px 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#374151;";
  const row = (k: string, v: string) => `<tr><td style="${cell}"><strong>${k}</strong></td><td style="${cell}">${esc(v)}</td></tr>`;
  const detailsHtml = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;border-collapse:collapse;">${[
    row("Name", u.name),
    row("Email", u.email),
    row("Mobile", u.mobile ?? "Not given"),
    row("User ID", u.id),
    row("Requested", new Date().toISOString()),
  ].join("")}</table>`;

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
    // Wording: admin Engagement → Email templates ("Reactivation request (to your support inbox)").
    await sendTemplateEmail("reactivation_request", {
      to,
      values: {
        user_name: u.name || u.email,
        user_email: u.email,
        user_details: detailsHtml,
        message: `<div style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#374151;">${bodyHtml}</div>`,
      },
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === SMTP_NOT_CONFIGURED) {
      return { ok: false, error: "Email isn't set up yet — please reach the admin another way." };
    }
    return { ok: false, error: "Couldn't send right now. Please try again later." };
  }
}
