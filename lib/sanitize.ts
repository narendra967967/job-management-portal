// Minimal, dependency-free sanitizer for the rich-text our editors produce
// (bold/italic/underline + lists). Allowlist tags, strip ALL attributes, and drop
// script/style blocks — so stored HTML is safe to render with dangerouslySetInnerHTML.
// Our contentEditable editors escape typed "<"/">" to entities, so there are no stray
// raw brackets to worry about. Sanitize on write; render the stored (safe) HTML.

const ALLOWED_TAGS = new Set(["p", "br", "b", "strong", "i", "em", "u", "ul", "ol", "li"]);

export function sanitizeRichText(html: string): string {
  if (!html) return "";
  let s = html;
  // Remove comments and whole dangerous blocks (including their content).
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<(script|style|iframe|object|embed|svg|math)\b[\s\S]*?<\/\1\s*>/gi, "");
  // Keep only allowed tags; drop every attribute; strip disallowed tags (keep text).
  s = s.replace(/<(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (_m, slash: string, tag: string) => {
    const t = tag.toLowerCase();
    return ALLOWED_TAGS.has(t) ? `<${slash}${t}>` : "";
  });
  return s.trim();
}

/** Strip tags to plain text (for validation, previews, and email text fallbacks). */
export function richTextToPlain(html: string): string {
  return html
    .replace(/<\/(p|ul|ol|li)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}
