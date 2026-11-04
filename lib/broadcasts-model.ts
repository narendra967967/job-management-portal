// Broadcasts: messages an admin sends to every user, in the app, by email or
// both. Shared by the admin screens and the user side. Categories live in code:
// each one is an audience rule, so adding one means writing its rule.

import { z } from "zod";

export type BroadcastCategory = "important" | "promotional";
export type BroadcastChannel = "in_app" | "email" | "both";
export type BroadcastStatus = "draft" | "scheduled" | "sending" | "sent" | "canceled";

export const BROADCAST_CATEGORIES: Record<
  BroadcastCategory,
  { label: string; audience: string; optOut: boolean }
> = {
  important: {
    label: "Important",
    audience: "Every user whose account isn't deactivated, on any plan. Nobody can opt out, so keep it to service news.",
    optOut: false,
  },
  promotional: {
    label: "Promotional",
    audience: "The same users, minus anyone who turned off promotional messages. Deactivated accounts never get these.",
    optOut: true,
  },
};

export const BROADCAST_CHANNELS: Record<BroadcastChannel, string> = {
  in_app: "In the app",
  email: "Email",
  both: "Both",
};

export const BROADCAST_STATUS_LABELS: Record<BroadcastStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  canceled: "Canceled",
};

export const sendsInApp = (c: BroadcastChannel) => c !== "email";
export const sendsEmail = (c: BroadcastChannel) => c !== "in_app";

export const BROADCAST_TITLE_MAX = 120;
/** Big enough for a long, image-heavy newsletter; email clients clip far below this. */
export const BROADCAST_HTML_MAX = 60_000;
/** Scheduled sends are picked up by the server's cron, so give it room. */
export const BROADCAST_SCHEDULE_MIN_MINUTES = 10;

export interface BroadcastDelivery {
  /** Users who got (or will get) it in the app. */
  inApp: number;
  /** Emails to send, and how many went out or failed so far. */
  emailTotal: number;
  emailSent: number;
  emailFailed: number;
}

export interface Broadcast {
  id: string;
  title: string;
  contentHtml: string;
  category: BroadcastCategory;
  channel: BroadcastChannel;
  status: BroadcastStatus;
  /** ISO time it's due, for a scheduled send. */
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  /** When sending began and finished. */
  startedAt: string | null;
  finishedAt: string | null;
  canceledAt: string | null;
  /** Filled in once sending starts. */
  delivery: BroadcastDelivery | null;
}

/** Who a broadcast would reach right now, with the reasons some won't get one part. */
export interface BroadcastAudience {
  inApp: number;
  email: number;
  /** In-app only shows once they renew. */
  expired: number;
  /** No email: address not confirmed yet. */
  unverified: number;
  /** Promotional only: turned promotional messages off. */
  optedOut: number;
}

/** A broadcast as one user receives it in the app. */
export interface InboxBroadcast {
  id: string;
  broadcastId: string;
  title: string;
  contentHtml: string;
  category: BroadcastCategory;
  at: string;
  read: boolean;
}

const plain = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
/** A short plain-text preview for the bell and lists. */
export const broadcastExcerpt = (html: string, max = 140) => {
  const t = plain(html);
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

export const broadcastInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Give it a title. It's the bell entry and the email subject.")
      .max(BROADCAST_TITLE_MAX, `Keep the title under ${BROADCAST_TITLE_MAX} characters.`),
    contentHtml: z
      .string()
      .max(BROADCAST_HTML_MAX, "The message is too long for an email. Trim it or link to a page instead.")
      .refine((h) => plain(h).length > 0 || /<img\b/i.test(h), "Write the message."),
    category: z.enum(["important", "promotional"]),
    channel: z.enum(["in_app", "email", "both"]),
    /** ISO time, or null to send now. */
    scheduledFor: z.string().datetime().nullable(),
  })
  .refine(
    (v) => !v.scheduledFor || new Date(v.scheduledFor).getTime() >= Date.now() + BROADCAST_SCHEDULE_MIN_MINUTES * 60_000 - 60_000,
    { message: `Pick a time at least ${BROADCAST_SCHEDULE_MIN_MINUTES} minutes from now.`, path: ["scheduledFor"] },
  );

export type BroadcastInput = z.infer<typeof broadcastInputSchema>;
