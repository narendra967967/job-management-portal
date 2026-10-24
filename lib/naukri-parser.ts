// Naukri job-alert email parser (pure, testable independently).
//
// Tuned against real naukrialerts@naukri.com alerts (Oct 2026: "Top Openings
// for…", "New Job Opportunities for…", "Immediate/Urgent Requirement for…"),
// 15 cards each. A card links to /jd/job-listings-<slug>-<job id> and reads:
//   title (link text) · company · [AmbitionBox rating] · location
// The experience range is in the URL slug ("…-4-to-9-years-<id>").
// Unparseable messages are recorded as ingestion issues by the caller.

import type { LeadDraft } from "@/lib/lead-draft";

const JOB_LINK = /https?:\/\/(?:www\.)?naukri\.com\/(?:jd\/)?job-listings-([a-z0-9-]*?)-(\d{9,})(?=[?#"']|$)/gi;

function decode(s: string): string {
  return s
    .replace(/&middot;/gi, "·")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

/** The card's visible text pieces, in order (one per element with text). */
function textPieces(chunk: string): string[] {
  return chunk
    .split(/<[^>]+>/)
    .map(decode)
    .filter(Boolean);
}

const RATING = /^\d(?:\.\d)?$/;

export function parseNaukriAlert(html: string): LeadDraft[] {
  const body = html.replace(/&amp;/gi, "&");

  // First occurrence of each job id marks where its card starts.
  const starts: { id: string; slug: string; at: number }[] = [];
  const seen = new Set<string>();
  for (const m of body.matchAll(JOB_LINK)) {
    if (seen.has(m[2])) continue;
    seen.add(m[2]);
    starts.push({ slug: m[1].toLowerCase(), id: m[2], at: m.index ?? 0 });
  }

  const drafts: LeadDraft[] = [];
  starts.forEach((s, i) => {
    const chunk = body.slice(s.at, starts[i + 1]?.at ?? s.at + 8000);
    // Skip the rest of the opening <a ...> tag the chunk starts inside.
    const pieces = textPieces(chunk.slice(chunk.indexOf(">") + 1));
    const title = pieces[0] ?? "";
    if (!title || /^https?:/i.test(title)) return;
    const rest = pieces.slice(1).filter((p) => !RATING.test(p));
    const company = rest[0] ?? "";
    const location = rest[1] ?? "";

    const tags: string[] = [];
    const exp = s.slug.match(/(\d+)-to-(\d+)-years?$/);
    if (exp) tags.push(`${exp[1]}–${exp[2]} yrs`);

    drafts.push({
      jobKey: `naukri:${s.id}`,
      title,
      company,
      location,
      remote: /\bremote\b/i.test(`${location} ${title}`),
      tags,
      postedRelative: "",
      canonicalJobUrl: `https://www.naukri.com/job-listings-${s.slug}-${s.id}`,
    });
  });
  return drafts;
}
