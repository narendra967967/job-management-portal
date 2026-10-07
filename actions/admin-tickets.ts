"use server";

// Admin Tickets actions — change status, and reply (emails the user via the global
// branded mailer and records the reply). Admin-guarded + Zod.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/current-user";
import { addTicketReply, setTicketStatus } from "@/lib/tickets";
import { sendAppEmail, SMTP_NOT_CONFIGURED } from "@/lib/email";

type Result = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/jmp-admin/tickets");
}

export async function setTicketStatusAction(id: unknown, status: unknown): Promise<Result> {
  await requireAdmin();
  const p = z
    .object({ id: z.string().uuid(), status: z.enum(["open", "in_progress", "resolved"]) })
    .safeParse({ id, status });
  if (!p.success) return { ok: false, error: "Invalid request." };
  await setTicketStatus(p.data.id, p.data.status);
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

  // Email the user the reply (best-effort — the reply is already recorded).
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
