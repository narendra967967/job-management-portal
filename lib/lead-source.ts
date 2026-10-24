// Which job platform a lead came from, derived from its URL's host. Pure (no
// server-only imports) so the add-lead form can show it live as well.

import type { LeadSource } from "@/lib/types";

// host suffix → source. A host matches when it IS the suffix or ends with
// "." + suffix (so "in.linkedin.com" → linkedin, "notlinkedin.com" → no match).
const HOST_SOURCES: [string, LeadSource][] = [
  ["linkedin.com", "linkedin"],
  ["lnkd.in", "linkedin"],
  ["naukri.com", "naukri"],
  ["indeed.com", "indeed"],
  ["glassdoor.com", "glassdoor"],
  ["glassdoor.co.in", "glassdoor"],
  ["wellfound.com", "wellfound"],
  ["angel.co", "wellfound"],
  ["instahyre.com", "instahyre"],
  ["foundit.in", "foundit"],
  ["monsterindia.com", "foundit"],
  ["timesjobs.com", "timesjobs"],
  ["theladders.com", "theladders"],
  ["ladders.co", "theladders"],
];

export function sourceFromUrl(rawUrl: string): LeadSource {
  let host: string;
  try {
    host = new URL(rawUrl.trim()).hostname.toLowerCase();
  } catch {
    return "other";
  }
  for (const [suffix, source] of HOST_SOURCES) {
    if (host === suffix || host.endsWith(`.${suffix}`)) return source;
  }
  return "other";
}
