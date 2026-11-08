// Email delivery: which service sends the app's email (SMTP or Amazon SES) and
// the Amazon SES details. Client-safe: types, checks and labels shared by the
// admin screen and the server. Every outbound email goes through lib/mailer.ts,
// which reads the chosen service. Spec: memory amazon-ses.

export type EmailProvider = "smtp" | "ses";

export const PROVIDER_LABELS: Record<EmailProvider, string> = {
  smtp: "SMTP",
  ses: "Amazon SES",
};

/** What SES reports about the account (Test connection). */
export interface SesAccountInfo {
  /** False while the account is in the SES sandbox. */
  productionAccess: boolean;
  /** False when AWS has paused sending for the account. */
  sendingEnabled: boolean;
  max24HourSend: number;
  sentLast24Hours: number;
  maxSendRate: number;
}

/** The Amazon SES details as the admin screen gets them. The secret never leaves the server. */
export interface SesSettings {
  region: string;
  accessKeyId: string;
  hasSecret: boolean;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  /** From the last successful Test connection. */
  account: SesAccountInfo | null;
}

export interface SesInput {
  region: string;
  accessKeyId: string;
  /** Empty keeps the saved secret. */
  secretAccessKey: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
}

/** Regions offered as suggestions; any valid region name can be typed. */
export const SES_REGION_SUGGESTIONS: { id: string; name: string }[] = [
  { id: "ap-south-1", name: "Mumbai" },
  { id: "ap-southeast-1", name: "Singapore" },
  { id: "ap-southeast-2", name: "Sydney" },
  { id: "ap-northeast-1", name: "Tokyo" },
  { id: "eu-west-1", name: "Ireland" },
  { id: "eu-west-2", name: "London" },
  { id: "eu-central-1", name: "Frankfurt" },
  { id: "us-east-1", name: "N. Virginia" },
  { id: "us-east-2", name: "Ohio" },
  { id: "us-west-2", name: "Oregon" },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function regionError(v: string): string {
  const r = v.trim();
  if (!r) return "";
  return /^[a-z]{2}(-gov)?-[a-z]+-\d{1,2}$/.test(r) ? "" : "That isn't an AWS region name, like ap-south-1.";
}

/** Long-term IAM user keys start with AKIA and are 20 characters. */
export function accessKeyIdError(v: string): string {
  const k = v.trim();
  if (!k) return "";
  if (k.startsWith("ASIA")) return "That's a temporary key. Create an access key for an IAM user instead.";
  return /^AKIA[A-Z0-9]{16}$/.test(k) ? "" : "Access key IDs start with AKIA and are 20 characters.";
}

export function secretKeyError(v: string): string {
  const s = v.trim();
  if (!s) return "";
  return /^[A-Za-z0-9/+=]{40}$/.test(s) ? "" : "A secret access key is 40 characters.";
}

export function emailError(v: string): string {
  const e = v.trim();
  if (!e) return "";
  return EMAIL.test(e) ? "" : "That doesn't look like an email address.";
}

/** What Amazon SES still needs before it can send, in plain words. */
export function sesMissing(s: Pick<SesSettings, "region" | "accessKeyId" | "hasSecret" | "fromEmail">): string[] {
  const out: string[] = [];
  if (!s.region) out.push("region");
  if (!s.accessKeyId) out.push("access key ID");
  if (!s.hasSecret) out.push("secret access key");
  if (!s.fromEmail) out.push("from email");
  return out;
}

/** SMTP can send when it's switched on with a server and a from address. */
export const smtpReady = (s: { enabled: boolean; host: string; fromEmail: string }) =>
  s.enabled && !!s.host.trim() && !!s.fromEmail.trim();
