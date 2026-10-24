// TimesJobs job-alert email parser (pure, testable independently).
//
// Tuned against a real jobalert@timesjobs.com email (Oct 2026, "Exciting roles
// matching your profile"). Each card follows an HTML comment <!-- Job Card -->
// and reads: title (link with a title attribute) · company · experience ·
// location · "Apply Now". Job links are opaque redirects (mredirect.html?_qe=…)
// with no stable job id, so the dedupe key is title + company (lib/job-key.ts);
// TimesJobs titles usually carry a requisition number, e.g. "(50912)".

import type { LeadDraft } from "@/lib/lead-draft";
import { jobKeyForTitle } from "@/lib/job-key";

function decode(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

export function parseTimesJobsAlert(html: string): LeadDraft[] {
  const byKey = new Map<string, LeadDraft>();
  for (const card of html.split(/<!--\s*Job Card\s*-->/i).slice(1)) {
    // The card's first link is usually the company logo; the title link is the
    // one with a title attribute (else the first link with text).
    const links = [...card.matchAll(/<a\b[^>]*href="(https?:\/\/(?:www\.)?timesjobs\.com\/[^"]+)"[^>]*>([\s\S]*?)<\/a\s*>/gi)];
    const link =
      links.find((l) => /\btitle=/i.test(l[0])) ?? links.find((l) => decode(l[2].replace(/<[^>]+>/g, " ")));
    if (!link) continue;
    const url = decode(link[1]);
    const titleAttr = link[0].match(/\btitle=(?:'([^']*)'|"([^"]*)")/i);
    const rawTitle = decode(titleAttr?.[1] ?? titleAttr?.[2] ?? link[2].replace(/<[^>]+>/g, " "));
    // Employer boilerplate some postings put in front of every title.
    const title = rawTitle.replace(/^career opportunities:\s*/i, "");
    if (!title) continue;

    const pieces = card
      .slice(card.indexOf(link[0]) + link[0].length)
      .split(/<[^>]+>/)
      .map(decode)
      .filter((p) => p && !/^(apply now|experience|location)$/i.test(p));
    const company = pieces[0] ?? "";
    const expIdx = pieces.findIndex((p) => /\d+\s*-\s*\d+\s*years?/i.test(p));
    const experience = expIdx >= 0 ? pieces[expIdx] : "";
    const location = expIdx >= 0 ? (pieces[expIdx + 1] ?? "") : (pieces[1] ?? "");

    const jobKey = jobKeyForTitle("timesjobs", rawTitle, company);
    if (byKey.has(jobKey)) continue;
    byKey.set(jobKey, {
      jobKey,
      title,
      company,
      location,
      remote: /\bremote\b/i.test(`${location} ${title}`),
      tags: experience ? [experience.replace(/\s*-\s*/, "–").replace(/years?/i, "yrs")] : [],
      postedRelative: "",
      canonicalJobUrl: url,
    });
  }
  return [...byKey.values()];
}
