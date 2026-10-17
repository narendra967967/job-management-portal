// How-to guides — shared model (types, icon keys, URL helpers). Pure: imported
// by the admin editor, the user /guides page and the server alike. Content is
// managed in the admin panel (Operations → How-to guides) and stored in the
// guide_topics table; each topic = sections → blocks:
//
//   text     Markdown-lite: **bold**, *italic*, `code`, [link](https://…),
//            "- " bullets and "1. " lists.
//   steps    Numbered how-to steps (title + optional detail).
//   callout  Highlighted tip / note / warning.
//   video    YouTube / Vimeo / Loom link (embedded), or empty = "coming soon".
//   image    Screenshot URL (https://… or a /public path).
//   links    Buttons into the app (paths like /settings?tab=ai) or https links.

export type GuideBlock =
  | { type: "text"; text: string }
  | { type: "steps"; steps: { title: string; detail?: string }[] }
  | { type: "callout"; tone: "tip" | "note" | "warning"; title?: string; text: string }
  | { type: "video"; title: string; url: string; duration?: string }
  | { type: "image"; src: string; alt: string; caption?: string }
  | { type: "links"; links: { label: string; href: string }[] };

export type GuideBlockType = GuideBlock["type"];

export interface GuideSection {
  heading: string;
  blocks: GuideBlock[];
}

export type GuideStatus = "active" | "inactive";

/** One menu entry on /guides (no sub-menus). */
export interface GuideTopic {
  id: string;
  /** URL id — /guides?topic=<slug>. */
  slug: string;
  title: string;
  summary: string;
  /** Key into GUIDE_ICON_KEYS (rendered by lib/guide-icons.tsx). */
  icon: string;
  /** Menu heading this topic sits under. */
  group: string;
  sortOrder: number;
  status: GuideStatus;
  /** Shows a "Guide in progress" badge. */
  inProgress: boolean;
  sections: GuideSection[];
  /** ISO. */
  updatedAt: string;
}

/** The icons an admin can pick for a topic. */
export const GUIDE_ICON_KEYS = [
  "rocket",
  "sparkles",
  "mail",
  "briefcase",
  "send",
  "bell",
  "file-text",
  "crown",
  "settings",
  "user",
  "shield",
  "book-open",
  "lightbulb",
  "life-buoy",
  "calendar",
  "gauge",
  "wallet",
  "notebook",
] as const;
export type GuideIconKey = (typeof GUIDE_ICON_KEYS)[number];

export const GUIDE_BLOCK_LABELS: Record<GuideBlockType, string> = {
  text: "Text",
  steps: "Steps",
  callout: "Tip / note box",
  video: "Video",
  image: "Screenshot",
  links: "Buttons / links",
};

/** "Set up your AI key" → "set-up-your-ai-key". */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** An empty block of the given type (what "Add block" inserts). */
export function emptyBlock(type: GuideBlockType): GuideBlock {
  switch (type) {
    case "text":
      return { type, text: "" };
    case "steps":
      return { type, steps: [{ title: "", detail: "" }] };
    case "callout":
      return { type, tone: "tip", title: "", text: "" };
    case "video":
      return { type, title: "", url: "", duration: "" };
    case "image":
      return { type, src: "", alt: "", caption: "" };
    case "links":
      return { type, links: [{ label: "", href: "" }] };
  }
}

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

/** In-app path ("/settings?tab=ai") — not protocol-relative ("//evil.com"). */
export function isAppPath(href: string): boolean {
  return /^\/(?!\/)/.test(href);
}

export function isHttpUrl(href: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(href);
}

/** Group topics under their menu headings; headings follow their first topic's order. */
export function groupGuides(topics: GuideTopic[]): { label: string; topics: GuideTopic[] }[] {
  const groups: { label: string; topics: GuideTopic[] }[] = [];
  for (const t of topics) {
    const g = groups.find((x) => x.label === t.group);
    if (g) g.topics.push(t);
    else groups.push({ label: t.group, topics: [t] });
  }
  return groups;
}
