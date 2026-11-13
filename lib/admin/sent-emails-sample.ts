// UI FIRST ONLY: made-up sent-email rows so the Sent emails page can be
// reviewed before the log table exists (dashboard phase 4 replaces this with
// the real log and this file is deleted). Deterministic: same rows every load,
// spread over the last 30 days.

import type { SentEmailKind, SentEmailRow } from "@/lib/admin/sent-emails-model";

const PEOPLE = [
  ["Rahul Mehta", "rahul.mehta@example.com"],
  ["Priya Nair", "priya.nair@example.com"],
  ["Karan Shah", "karan.shah@example.com"],
  ["Meera Iyer", "meera.iyer@example.com"],
  ["Arjun Das", "arjun.das@example.com"],
  ["Ananya Rao", "ananya.rao@example.com"],
  ["Sneha Kulkarni", "sneha.k@example.com"],
  ["Vikram Joshi", "vikram.joshi@example.com"],
  ["Fatima Khan", "fatima.khan@example.com"],
  ["Rohan Gupta", "rohan.gupta@example.com"],
] as const;

const TEMPLATES: { key: string; label: string; subject: string; weight: number }[] = [
  { key: "verify_email", label: "Confirm your email", subject: "Confirm your Jobtiva email", weight: 6 },
  { key: "reset_password", label: "Reset your password", subject: "Reset your Jobtiva password", weight: 3 },
  { key: "plan_ending", label: "Your plan ends soon", subject: "Your Jobtiva Pro plan ends in 3 days", weight: 3 },
  { key: "payment_received", label: "Payment received", subject: "Payment received: Jobtiva Pro", weight: 2 },
  { key: "code_reset_leads", label: "Code to reset your leads", subject: "Your Jobtiva code", weight: 1 },
  { key: "deletion_received", label: "Deletion request received", subject: "We've received your deletion request", weight: 1 },
];

const ERRORS = [
  "SES refused it because an address isn't verified. While the account is in the sandbox, the from address and every recipient must be verified in SES.",
  "The recipient's mail server said the mailbox doesn't exist (550).",
  "SES is limiting how fast this account can send. Try again in a minute.",
];

function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function sampleSentEmails(now = Date.now()): SentEmailRow[] {
  const r = rng(424242);
  const rows: SentEmailRow[] = [];
  const pickTemplate = () => {
    const total = TEMPLATES.reduce((a, t) => a + t.weight, 0);
    let x = r() * total;
    for (const t of TEMPLATES) if ((x -= t.weight) <= 0) return t;
    return TEMPLATES[0];
  };
  for (let i = 0; i < 220; i++) {
    const at = now - Math.floor(r() * 30 * 86_400_000);
    const [name, email] = PEOPLE[Math.floor(r() * PEOPLE.length)];
    const roll = r();
    const kind: SentEmailKind = roll < 0.78 ? "template" : roll < 0.97 ? "broadcast" : "test";
    const t = pickTemplate();
    const failed = r() < 0.04;
    const channel = r() < 0.85 ? "Amazon SES" : "SMTP";
    rows.push({
      id: `s${i}`,
      sentAt: new Date(at).toISOString(),
      to: kind === "test" ? "admin@example.com" : email,
      userId: kind === "test" ? null : `u-${email}`,
      userName: kind === "test" ? null : name,
      kind,
      templateKey: kind === "template" ? t.key : null,
      broadcastId: kind === "broadcast" ? "sample-broadcast" : null,
      label: kind === "template" ? t.label : kind === "broadcast" ? "Plan prices from December" : `${channel} test email`,
      subject:
        kind === "template" ? t.subject : kind === "broadcast" ? "Plan prices from December" : `Jobtiva: ${channel} test email`,
      channel,
      status: failed ? "failed" : "sent",
      error: failed ? ERRORS[Math.floor(r() * ERRORS.length)] : null,
      messageId: failed
        ? null
        : channel === "Amazon SES"
          ? `0109019a${Math.floor(r() * 1e12).toString(16)}-000000@ap-south-1.amazonses.com`
          : `<${Math.floor(r() * 1e12).toString(16)}@jobtiva.in>`,
    });
  }
  return rows.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}
