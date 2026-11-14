import "server-only";

// Writes the sent-email log (admin Monitoring → Sent emails) for lib/mailer.ts.
// Recording must never block, slow down or break a send: the mailer calls
// logSentEmail without awaiting it, and a failed insert is only reported to the
// server log. No email content is stored, only who it went to, which email, the
// channel and the result (docs/admin-dashboard/spec.md, "New data").

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { SentEmailStatus, SentEmailTag } from "@/lib/admin/sent-emails-model";

export interface SentEmailEntry {
  to: string;
  subject: string;
  tag: SentEmailTag;
  channel: string;
  status: SentEmailStatus;
  error?: string | null;
  messageId?: string | null;
}

/** Channel errors are kept short, and anything shaped like an AWS key is masked. */
export function cleanSendError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg
    .replace(/\b(AKIA|ASIA)[A-Z0-9]{12,}\b/g, "[access key]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function insert(e: SentEmailEntry): Promise<void> {
  const broadcastId = e.tag.broadcastId && UUID_RE.test(e.tag.broadcastId) ? e.tag.broadcastId : null;
  await db.execute(sql`
    insert into sent_email_log
      (to_address, user_id, kind, template_key, broadcast_id, label, subject, channel, status, error, message_id)
    values (
      ${e.to},
      (select id from "user" where lower(email) = lower(${e.to}) limit 1),
      ${e.tag.kind},
      ${e.tag.templateKey ?? null},
      (select id from broadcasts where id = ${broadcastId}::uuid),
      ${e.tag.label.slice(0, 300)},
      ${e.subject.slice(0, 300)},
      ${e.channel},
      ${e.status},
      ${e.error ?? null},
      ${e.messageId ? e.messageId.slice(0, 300) : null}
    )`);
}

/** Records one send in the background. Never throws and is never awaited by the sender. */
export function logSentEmail(e: SentEmailEntry): void {
  insert(e).catch((err) => {
    console.error("[sent-email-log] couldn't record an email:", err instanceof Error ? err.message : err);
  });
}
