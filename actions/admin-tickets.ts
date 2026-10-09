"use server";

// Admin Tickets actions — status (single + bulk), reply, delete. Moving a ticket to
// "resolved" emails the user the full conversation as a record. Admin-guarded + Zod.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/current-user";
import {
  addTicketReply,
  deleteTickets,
  getTicket,
  setTicketStatus,
  type Ticket,
} from "@/lib/tickets";
import { sendAppEmail, SMTP_NOT_CONFIGURED } from "@/lib/email";

type Result = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/jmp-admin/tickets");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

/** Email the user the full ticket conversation when it's resolved. Best-effort. */
async function sendResolvedEmail(ticket: Ticket): Promise<void> {
  if (!ticket.email) return;
  const block = (label: string, bodyHtml: string, when: string) => `
    <div style="margin:0 0 14px;">
      <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7280;">${esc(label)} · ${esc(when)}</p>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#374151;border-left:3px solid #e5e7eb;padding-left:10px;">${bodyHtml}</div>
    </div>`;
  let convo = block("You wrote", ticket.message, fmt(ticket.createdAt));
  for (const r of ticket.replies) {
    convo += block("Support replied", `<p style="margin:0;">${esc(r.body).replace(/\n/g, "<br>")}</p>`, fmt(r.createdAt));
  }

  const textParts = [`You wrote (${fmt(ticket.createdAt)}):`, ticket.message.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()];
  for (const r of ticket.replies) textParts.push(`Support replied (${fmt(r.createdAt)}):`, r.body);

  try {
    await sendAppEmail({
      to: ticket.email,
      subject: `Resolved: ${ticket.subject}`,
      heading: "Your request has been resolved",
      bodyHtml: `<p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#374151;">Hi ${esc(ticket.name || "there")}, we've marked your request &ldquo;<strong>${esc(ticket.subject)}</strong>&rdquo; as resolved. Here&rsquo;s the full conversation for your records:</p>${convo}<p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b7280;">Still need help? Just contact support again and we&rsquo;ll reopen it.</p>`,
      text: `Your request "${ticket.subject}" has been resolved. Full conversation:\n\n${textParts.join("\n\n")}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg !== SMTP_NOT_CONFIGURED) console.error("[tickets] resolved email failed:", msg);
  }
}

/** Set status for one ticket; emails the transcript when it becomes resolved. */
export async function setTicketStatusAction(id: unknown, status: unknown): Promise<Result> {
  await requireAdmin();
  const p = z
    .object({ id: z.string().uuid(), status: z.enum(["open", "in_progress", "resolved"]) })
    .safeParse({ id, status });
  if (!p.success) return { ok: false, error: "Invalid request." };

  const ticket = await getTicket(p.data.id);
  if (!ticket) return { ok: false, error: "Ticket not found." };
  const becameResolved = p.data.status === "resolved" && ticket.status !== "resolved";

  await setTicketStatus(p.data.id, p.data.status);
  if (becameResolved) await sendResolvedEmail({ ...ticket, status: "resolved" });
  revalidate();
  return { ok: true };
}

/** Bulk status change (multi-select). Emails the transcript for each newly-resolved ticket. */
export async function bulkSetTicketStatusAction(ids: unknown, status: unknown): Promise<Result> {
  await requireAdmin();
  const p = z
    .object({ ids: z.array(z.string().uuid()).min(1).max(200), status: z.enum(["open", "in_progress", "resolved"]) })
    .safeParse({ ids, status });
  if (!p.success) return { ok: false, error: "Invalid request." };

  // Update statuses first (fast), then send the resolved transcripts in parallel.
  const toEmail: Ticket[] = [];
  for (const id of p.data.ids) {
    const ticket = await getTicket(id);
    if (!ticket) continue;
    const becameResolved = p.data.status === "resolved" && ticket.status !== "resolved";
    await setTicketStatus(id, p.data.status);
    if (becameResolved) toEmail.push({ ...ticket, status: "resolved" });
  }
  await Promise.allSettled(toEmail.map((t) => sendResolvedEmail(t)));
  revalidate();
  return { ok: true };
}

export async function deleteTicketsAction(ids: unknown): Promise<Result> {
  await requireAdmin();
  const p = z.array(z.string().uuid()).min(1).max(200).safeParse(ids);
  if (!p.success) return { ok: false, error: "Invalid request." };
  await deleteTickets(p.data);
  revalidate();
  return { ok: true };
}

export async function replyTicketAction(id: unknown, body: unknown): Promise<Result> {
  await requireAdmin();
  const p = z
    .object({ id: z.string().uuid(), body: z.string().trim().min(1, "Write a reply.").max(10000) })
    .safeParse({ id, body });
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Invalid reply." };

  const ticket = await addTicketReply(p.data.id, p.data.body);
  if (!ticket) return { ok: false, error: "Ticket not found." };

  let emailed = true;
  if (ticket.email) {
    try {
      await sendAppEmail({
        to: ticket.email,
        subject: `Re: ${ticket.subject}`,
        heading: "Reply from support",
        lines: [body as string],
      });
    } catch (e) {
      emailed = false;
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== SMTP_NOT_CONFIGURED) console.error("[tickets] reply email failed:", msg);
    }
  } else {
    emailed = false;
  }
  revalidate();
  return emailed ? { ok: true } : { ok: false, error: "Reply saved, but the email couldn't be sent." };
}
