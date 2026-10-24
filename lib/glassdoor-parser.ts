// Glassdoor job email parser (pure, testable independently).
//
// Tuned against a real noreply@glassdoor.com email (Oct 2026, a community
// digest carrying a "Discover your next job" card). Job cards link to
// …/partner/jobListing.htm?…&jobListingId=<id>&… and read:
//   company · [rating ★] · title · location · [badges, e.g. "Easy Apply"]
// The key is glassdoor:<jobListingId>; the stored link is Glassdoor's share
// form (/job-listing/j?jl=<id>) on the email's own host, without tracking.
// Only one card was available to tune against — confirm with a real job alert.

import type { LeadDraft } from "@/lib/lead-draft";

const JOB_LINK =
  /https?:\/\/(?:www\.)?(glassdoor\.[a-z.]+)\/partner\/jobListing\.htm\?[^"'\s>]*?\bjobListingId=(\d{6,})/gi;

function decode(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

const RATING = /^\d(?:\.\d)?\s*★?$/;

export function parseGlassdoorAlert(html: string): LeadDraft[] {
  const body = html.replace(/&amp;/gi, "&");

  const starts: { id: string; host: string; at: number }[] = [];
  const seen = new Set<string>();
  for (const m of body.matchAll(JOB_LINK)) {
    if (seen.has(m[2])) continue;
    seen.add(m[2]);
    starts.push({ host: m[1].toLowerCase(), id: m[2], at: m.index ?? 0 });
  }

  const drafts: LeadDraft[] = [];
  starts.forEach((s, i) => {
    // The card is the link's own content (Glassdoor wraps the whole card in it).
    const from = body.indexOf(">", s.at) + 1;
    const close = body.slice(from).search(/<\/a\s*>/i);
    const end = Math.min(close >= 0 ? from + close : from + 6000, starts[i + 1]?.at ?? Infinity);
    const pieces = body
      .slice(from, end)
      .split(/<[^>]+>/)
      .map(decode)
      .filter(Boolean);
    const rest = pieces.filter((p) => !RATING.test(p));
    const [company = "", title = "", location = "", ...badges] = rest;
    if (!title) return;

    drafts.push({
      jobKey: `glassdoor:${s.id}`,
      title,
      company,
      location,
      remote: /\bremote\b/i.test(`${location} ${title}`),
      tags: badges.filter((b) => b.length <= 30).slice(0, 3),
      postedRelative: "",
      canonicalJobUrl: `https://www.${s.host}/job-listing/j?jl=${s.id}`,
    });
  });
  return drafts;
}
