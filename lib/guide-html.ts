import "server-only";

// HTML sanitizer for How-to guide content (written in the admin's rich-text /
// code editor, shown to every user). Allow-list only: formatting, headings,
// lists, tables, code, links, images, <video>, and <iframe> from YouTube /
// Vimeo / Loom. Scripts, styles, event handlers (on*), forms and unknown tags
// are removed. Runs when a guide is saved AND when it's served (so a row edited
// straight in the DB is still made safe).

import sanitizeHtml from "sanitize-html";

const IFRAME_HOSTS = [
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
  "www.loom.com",
];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "br", "hr", "div", "span",
    "strong", "b", "em", "i", "u", "s", "del", "ins", "mark", "sub", "sup", "small",
    "blockquote", "code", "pre", "kbd",
    "ul", "ol", "li",
    "a", "img", "figure", "figcaption",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
    "iframe", "video", "source",
    "details", "summary",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    iframe: ["src", "title", "width", "height", "allow", "allowfullscreen", "frameborder", "loading", "referrerpolicy"],
    video: ["src", "poster", "controls", "width", "height", "preload", "muted", "loop", "playsinline"],
    source: ["src", "type"],
    th: ["colspan", "rowspan", "scope"],
    td: ["colspan", "rowspan"],
    ol: ["start", "type"],
    code: ["class"], // only language-* (see allowedClasses)
  },
  allowedClasses: { code: [/^language-[\w-]+$/] },
  // Links: web + mail; images/video: https or a site path like /guides/x.png.
  allowedSchemes: ["https", "http", "mailto"],
  allowedSchemesByTag: { img: ["https"], video: ["https"], source: ["https"], iframe: ["https"] },
  allowProtocolRelative: false, // no "//evil.com"
  allowedIframeHostnames: IFRAME_HOSTS,
  allowIframeRelativeUrls: false,
  // An iframe whose src was removed (not an allowed host) is dropped entirely.
  exclusiveFilter: (frame) => frame.tag === "iframe" && !frame.attribs.src,
  transformTags: {
    // External links open in a new tab, safely; in-app links stay in the tab.
    a: (tagName, attribs) => {
      const href = attribs.href ?? "";
      if (/^https?:\/\//i.test(href)) {
        return { tagName, attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" } };
      }
      const { target: _t, rel: _r, ...rest } = attribs;
      void _t;
      void _r;
      return { tagName, attribs: rest };
    },
    iframe: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        loading: "lazy",
        referrerpolicy: "strict-origin-when-cross-origin",
        allowfullscreen: "",
      },
    }),
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
  },
};

/** Sanitized guide HTML (safe to render with dangerouslySetInnerHTML). */
export function sanitizeGuideHtml(html: string): string {
  return sanitizeHtml(html ?? "", OPTIONS).trim();
}

/** Plain-text length of guide HTML (for limits / "is it empty?"). */
export function guideTextLength(html: string): number {
  return sanitizeHtml(html ?? "", { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim().length;
}
