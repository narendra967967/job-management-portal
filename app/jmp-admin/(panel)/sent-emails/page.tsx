import { requireAdmin } from "@/lib/current-user";
import { SentEmailsClient } from "@/components/admin/sent-emails/sent-emails-client";
import { sampleSentEmails } from "@/lib/admin/sent-emails-sample";

// Admin → Monitoring → Sent emails. UI FIRST: the rows are sample data until
// dashboard phase 4 adds the log table and records every send at
// lib/mailer.ts sendMailWith (docs/admin-dashboard/spec.md).
export const dynamic = "force-dynamic";

export default async function SentEmailsPage() {
  await requireAdmin();
  return <SentEmailsClient rows={sampleSentEmails()} sample />;
}
