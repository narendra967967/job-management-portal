// The per-user "same job?" key, stored in job_leads.linkedin_job_id (the column
// predates other job sites — it is a generic key, unique per user). Every path
// that creates a lead (email readers, manual Add lead) builds it here, so the
// same job is recognised however it arrives:
//   LinkedIn  → the bare numeric job id          (e.g. "4465649386")
//   Naukri    → "naukri:<job id>"                (e.g. "naukri:161026010673")
//   TimesJobs → "timesjobs:<title>|<company>"    (its links are opaque redirects)
//   other     → "url:<normalized URL>"
// Pure — no server-only imports.

import { extractLinkedInJobId } from "@/lib/linkedin-parser";

/** Naukri's job number from a job-listing URL (/job-listings-<slug>-<id>). */
export function extractNaukriJobId(url: string): string {
  const m = url.match(/naukri\.com\/(?:jd\/)?job-listings-[a-z0-9-]*?-(\d{9,})(?=[/?#]|$)/i);
  return m ? m[1] : "";
}

export function jobKeyForUrl(rawUrl: string): string {
  const linkedIn = extractLinkedInJobId(rawUrl);
  if (linkedIn) return linkedIn;
  const naukri = extractNaukriJobId(rawUrl);
  if (naukri) return `naukri:${naukri}`;
  try {
    const u = new URL(rawUrl);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    return `url:${u.toString().replace(/\/+$/, "")}`;
  } catch {
    // Not a parseable URL — fall back to text.
    return `url:${rawUrl.trim().toLowerCase().replace(/\/+$/, "")}`;
  }
}

/** For sites whose job links carry no stable id: site + title + company. */
export function jobKeyForTitle(site: string, title: string, company: string): string {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return `${site}:${norm(title)}|${norm(company)}`.slice(0, 300);
}
