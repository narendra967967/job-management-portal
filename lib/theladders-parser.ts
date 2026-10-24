// TheLadders job-alert email parser (pure, testable independently).
//
// Tuned against a real jobs@my.theladders.com alert (Oct 2026, "New Jobs
// Posted: Apply before others do", 10 jobs). Each card is:
//   <a class="jobTitle" href="https://t.ladders.co/f/a/…">Title</a>
//   <span class="jobSalary">$95K - $115K*</span>
//   <span class="jobCompanyAndLocation"> | Company | City, ST </span>
// Links are click-tracking redirects with no job id, so the dedupe key is
// title + company + location (lib/job-key.ts) — one company often posts the
// same title in several cities.

import type { LeadDraft } from "@/lib/lead-draft";
import { jobKeyForTitle } from "@/lib/job-key";

function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

export function parseTheLaddersAlert(html: string): LeadDraft[] {
  const byKey = new Map<string, LeadDraft>();
  const titleRe = /<a\b[^>]*class="[^"]*\bjobTitle\b[^"]*"[^>]*>([\s\S]*?)<\/a\s*>/gi;
  for (const m of html.matchAll(titleRe)) {
    const title = decode(m[1]);
    if (!title) continue;
    const href = m[0].match(/\bhref="([^"]+)"/i)?.[1];
    // This card's details sit between its title and the next card's title.
    const after = html.slice((m.index ?? 0) + m[0].length);
    const next = after.search(/class="[^"]*\bjobTitle\b/i);
    const card = next >= 0 ? after.slice(0, next) : after.slice(0, 4000);

    const salary = decode(card.match(/class="[^"]*\bjobSalary\b[^"]*"[^>]*>([\s\S]*?)<\/span\s*>/i)?.[1] ?? "");
    const meta = decode(card.match(/class="[^"]*\bjobCompanyAndLocation\b[^"]*"[^>]*>([\s\S]*?)<\/span\s*>/i)?.[1] ?? "");
    const [company = "", ...loc] = meta
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    const location = loc.join(", ");

    const jobKey = jobKeyForTitle("theladders", title, `${company} ${location}`);
    if (byKey.has(jobKey)) continue;
    byKey.set(jobKey, {
      jobKey,
      title,
      company,
      location,
      remote: /\bremote\b/i.test(`${location} ${title}`),
      // "$95K - $115K*" → "$95K–$115K" (the * marks a Ladders estimate).
      tags: salary ? [salary.replace(/\*+$/, "").replace(/\s*-\s*/, "–")] : [],
      postedRelative: "",
      canonicalJobUrl: href ? decode(href) : "",
    });
  }
  return [...byKey.values()];
}
