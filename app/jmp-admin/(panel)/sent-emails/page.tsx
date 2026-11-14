import { requireAdmin } from "@/lib/current-user";
import { SentEmailsClient } from "@/components/admin/sent-emails/sent-emails-client";
import { loadSentEmails } from "@/lib/admin/sent-emails-data";
import { getRetentionConfig } from "@/lib/retention";

// Admin → Monitoring → Sent emails: every email the app handed to a channel,
// recorded at lib/mailer.ts sendMailWith (docs/admin-dashboard/spec.md).
export const dynamic = "force-dynamic";

export default async function SentEmailsPage() {
  await requireAdmin();
  const [{ rows, capped }, retention] = await Promise.all([loadSentEmails(), getRetentionConfig()]);
  return <SentEmailsClient rows={rows} capped={capped} keepDays={retention.sentEmailLogDays} />;
}
