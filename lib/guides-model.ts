// How-to guides — shared model (types, icon keys, URL helpers). Pure: imported
// by the admin editor, the user /guides page and the server alike. Guides are
// managed in the admin panel (Operations → How-to guides) and stored in
// guide_topics; each is a title + summary + an HTML body written in a
// WordPress-style editor (Visual / Code), sanitized by lib/guide-html.ts.

export type GuideStatus = "active" | "inactive";

/** One menu entry on /guides (a flat list — no groups, no sub-menus). */
export interface GuideTopic {
  id: string;
  /** URL id — /guides?topic=<slug>. */
  slug: string;
  title: string;
  summary: string;
  /** Key into GUIDE_ICON_KEYS (rendered by lib/guide-icons.tsx). */
  icon: string;
  sortOrder: number;
  status: GuideStatus;
  /** Shows a "Guide in progress" badge. */
  inProgress: boolean;
  /** The guide body — sanitized HTML from the admin's rich-text editor. */
  contentHtml: string;
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
