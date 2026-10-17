// How-to guides content (the /guides page). Plain data, so writing a guide is
// editing this file — no UI code. Each TOPIC is one menu entry (no sub-menus);
// a topic has sections, and each section is a list of blocks:
//
//   text     Markdown-lite paragraph(s): **bold**, *italic*, `code`,
//            [external link](https://…), "- " bullet lists, "1. " lists.
//   steps    Numbered how-to steps (title + optional detail).
//   callout  A highlighted tip / note / warning.
//   video    A YouTube / Vimeo / Loom link, embedded in place (or a
//            "coming soon" card while `url` is empty).
//   image    A screenshot from /public (src like "/guides/ai-key-1.png").
//   links    Buttons into the app, e.g. "Open Settings → AI provider".
//
// Topics with `draft: true` show a "Guide in progress" note.

import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BriefcaseBusiness,
  Crown,
  FileText,
  Mail,
  Rocket,
  Send,
  Sparkles,
} from "lucide-react";

export type GuideBlock =
  | { type: "text"; text: string }
  | { type: "steps"; steps: { title: string; detail?: string }[] }
  | { type: "callout"; tone: "tip" | "note" | "warning"; title?: string; text: string }
  | { type: "video"; title: string; url: string; duration?: string }
  | { type: "image"; src: string; alt: string; caption?: string }
  | { type: "links"; links: { label: string; href: string }[] };

export interface GuideSection {
  heading: string;
  blocks: GuideBlock[];
}

export interface GuideTopic {
  id: string;
  title: string;
  icon: LucideIcon;
  /** One line under the title (and the menu tooltip). */
  summary: string;
  /** Still being written — shows a "Guide in progress" note. */
  draft?: boolean;
  sections: GuideSection[];
}

const COMING_SOON: GuideSection[] = [
  {
    heading: "What this guide will cover",
    blocks: [
      {
        type: "callout",
        tone: "note",
        text: "This guide is being written. Meanwhile, use **Help & support** if you get stuck — we reply quickly.",
      },
    ],
  },
];

const TOPIC = {
  start: {
    id: "getting-started",
    title: "Getting started",
    icon: Rocket,
    summary: "What Jobtiva does and the first things to set up.",
    draft: true,
    sections: COMING_SOON,
  },
  ai: {
    id: "ai-key",
    title: "Set up your AI key",
    icon: Sparkles,
    summary: "Connect OpenAI, Anthropic or OpenRouter so AI features work.",
    draft: true,
    sections: [
      {
        heading: "Why you need it",
        blocks: [
          {
            type: "text",
            text: "Jobtiva's AI features — job-description summaries, fit scores, outreach drafts and salary insights — run on **your own AI account**. You add an API key once; it's encrypted and only its last 4 characters are ever shown back.",
          },
        ],
      },
      {
        heading: "Add your key",
        blocks: [
          {
            type: "steps",
            steps: [
              { title: "Create an API key with your AI provider", detail: "Step-by-step for each provider is coming in this guide." },
              { title: "Open Settings → AI provider", detail: "Pick the same provider you created the key with." },
              { title: "Paste the key and save", detail: "You'll see the last 4 characters once it's stored." },
              { title: "Try it", detail: "Open a job, paste its description and choose Save & Summarize with AI." },
            ],
          },
          { type: "links", links: [{ label: "Open Settings → AI provider", href: "/settings?tab=ai" }] },
          {
            type: "callout",
            tone: "warning",
            title: "Keep your key private",
            text: "Never share it in emails or support tickets. If you think it leaked, delete it in your provider's dashboard and add a new one here.",
          },
        ],
      },
      {
        heading: "Watch how",
        blocks: [{ type: "video", title: "Setting up your AI key", url: "" }],
      },
    ],
  },
  gmail: {
    id: "gmail",
    title: "Connect Gmail & sync jobs",
    icon: Mail,
    summary: "Bring job alerts in automatically, and pause syncing when you need to.",
    draft: true,
    sections: COMING_SOON,
  },
  leads: {
    id: "leads",
    title: "Work your leads",
    icon: BriefcaseBusiness,
    summary: "Statuses, Top Choice, the board, filters and automatic status updates.",
    draft: true,
    sections: COMING_SOON,
  },
  outreach: {
    id: "outreach",
    title: "Contacts & outreach",
    icon: Send,
    summary: "Add recruiters and referrals, draft messages, mark them sent.",
    draft: true,
    sections: COMING_SOON,
  },
  followups: {
    id: "follow-ups",
    title: "Reminders & follow-ups",
    icon: Bell,
    summary: "How follow-ups are scheduled and chained, and what To-do shows.",
    draft: true,
    sections: COMING_SOON,
  },
  resumes: {
    id: "resumes",
    title: "Résumés & fit score",
    icon: FileText,
    summary: "Upload résumés, set a default, and score how well you fit a job.",
    draft: true,
    sections: COMING_SOON,
  },
  premium: {
    id: "premium",
    title: "Plans & premium features",
    icon: Crown,
    summary: "Notes, salary insight, and how to upgrade your plan.",
    draft: true,
    sections: COMING_SOON,
  },
} satisfies Record<string, GuideTopic>;

/** Menu groups (headings only — every topic is a single entry). */
export const GUIDE_GROUPS: { label: string; topics: GuideTopic[] }[] = [
  { label: "Start here", topics: [TOPIC.start, TOPIC.ai, TOPIC.gmail] },
  { label: "Your job search", topics: [TOPIC.leads, TOPIC.outreach, TOPIC.followups, TOPIC.resumes] },
  { label: "Account", topics: [TOPIC.premium] },
];

export const GUIDE_TOPICS: GuideTopic[] = GUIDE_GROUPS.flatMap((g) => g.topics);

/**
 * Embeddable URL for a YouTube / Vimeo / Loom link, or null when it isn't one
 * (the page then shows a plain link instead).
 */
export function videoEmbedUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:embed|shorts)\/([^/?]+)/)?.[1];
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === "vimeo.com") {
    const id = u.pathname.match(/^\/(\d+)/)?.[1];
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  if (host === "loom.com") {
    const id = u.pathname.match(/^\/share\/([\w-]+)/)?.[1];
    return id ? `https://www.loom.com/embed/${id}` : null;
  }
  return null;
}
