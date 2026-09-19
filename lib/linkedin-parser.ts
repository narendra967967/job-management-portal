// LinkedIn job-alert email parser (pure, testable independently — FRD NFR).
//
// FIRST PASS: this extracts each job card's canonical id/URL and title from the
// alert HTML. LinkedIn's template varies and isn't public, so company/location/
// tags are best-effort and this WILL need tuning against a real alert email
// (that's expected — the FRD scopes a failure queue for template drift). The
// sync routes anything unparseable to gmail_ingest_errors rather than dropping it.

export interface LeadDraft {
  linkedinJobId: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  tags: string[];
  postedRelative: string;
  canonicalJobUrl: string;
}

/** Pull the numeric LinkedIn job id out of any job URL / tracking redirect. */
export function extractLinkedInJobId(url: string): string {
  const m =
    url.match(/\/jobs\/view\/(\d+)/) ??
    url.match(/(?:currentJobId|jobId)=(\d+)/) ??
    url.match(/\/comm\/jobs\/view\/(\d+)/);
  return m ? m[1] : "";
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse a LinkedIn alert email's HTML into lead drafts, one per job card.
 * Dedupes by job id within the email.
 */
export function parseLinkedInAlert(html: string): LeadDraft[] {
  const byId = new Map<string, LeadDraft>();

  // Every job card links to the posting; find those anchors and their text.
  const anchorRe =
    /<a\b[^>]*href="([^"]*jobs\/view\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    const href = m[1].replace(/&amp;/g, "&");
    const id = extractLinkedInJobId(href);
    if (!id || byId.has(id)) continue;

    const title = stripTags(m[2]);
    if (!title) continue; // an anchor with no text is likely an image/tracking pixel

    byId.set(id, {
      linkedinJobId: id,
      title,
      company: "",
      location: "",
      remote: /remote/i.test(title),
      tags: [],
      postedRelative: "",
      canonicalJobUrl: `https://www.linkedin.com/jobs/view/${id}`,
    });
  }

  return [...byId.values()];
}
