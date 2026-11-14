import "server-only";

// Reads the sent-email log for admin Monitoring → Sent emails. The table is
// written by lib/sent-email-log.ts and trimmed by Data retention, so loading
// everything kept is bounded; MAX_ROWS is a guard for a very busy month.

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { SentEmailKind, SentEmailRow, SentEmailStatus } from "@/lib/admin/sent-emails-model";

const MAX_ROWS = 5000;
const KINDS: SentEmailKind[] = ["template", "broadcast", "test"];

type Raw = {
  id: string;
  sent_at: Date | string;
  to_address: string;
  user_id: string | null;
  user_name: string | null;
  kind: string;
  template_key: string | null;
  broadcast_id: string | null;
  label: string;
  subject: string;
  channel: string;
  status: string;
  error: string | null;
  message_id: string | null;
};

export async function loadSentEmails(): Promise<{ rows: SentEmailRow[]; capped: boolean }> {
  const res = await db.execute(sql`
    select l.id, l.sent_at, l.to_address, l.user_id, u.name as user_name, l.kind, l.template_key,
           l.broadcast_id, l.label, l.subject, l.channel, l.status, l.error, l.message_id
    from sent_email_log l
    left join "user" u on u.id = l.user_id
    order by l.sent_at desc
    limit ${MAX_ROWS + 1}`);
  const raw = res.rows as Raw[];
  return {
    capped: raw.length > MAX_ROWS,
    rows: raw.slice(0, MAX_ROWS).map((r) => ({
      id: r.id,
      sentAt: new Date(r.sent_at).toISOString(),
      to: r.to_address,
      userId: r.user_id,
      userName: r.user_name,
      kind: KINDS.includes(r.kind as SentEmailKind) ? (r.kind as SentEmailKind) : "template",
      templateKey: r.template_key,
      broadcastId: r.broadcast_id,
      label: r.label,
      subject: r.subject,
      channel: r.channel,
      status: (r.status === "failed" ? "failed" : "sent") as SentEmailStatus,
      error: r.error,
      messageId: r.message_id,
    })),
  };
}
