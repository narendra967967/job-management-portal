// LinkedIn job-alert email parser (pure, testable independently — FRD NFR).
//
// Tuned against real templates: "email_job_alert_digest_01" (Sept 2026) and
// the newer generic-section emails (Oct 2026, e.g. "<Title> at <Company>").
// Each job card carries data-test-id="job-card" (digest) or
// data-test-id="email-generic-section-JOBS_POSTING_SECTION-job-cards"
// (generic), and contains:
//   - a bold title:             <a|div ... class="...font-bold...">Project Manager</a|div>
//   - a company/location line:  <p class="...text-system-gray-100...">Company · City (Remote)</p>
//   - zero or more badges:      <p class="job-card-flavor__detail">Actively recruiting</p>
// LinkedIn's template can change without notice, so unparseable messages are
// routed to gmail_ingest_errors by the sync rather than dropped.

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
    url.match(/(?:currentJobId|jobId)=(\d+)/);
  return m ? m[1] : "";
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&middot;/gi, "·")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(chunk: string, re: RegExp): string {
  const m = chunk.match(re);
  return m ? stripTags(m[1]) : "";
}

function firstJobLinkText(chunk: string): string {
  const re = /<a\b[^>]*\/jobs\/view\/\d+[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chunk)) !== null) {
    const text = stripTags(m[1]);
    if (text) return text;
  }
  return "";
}

/** Parse a LinkedIn alert email's HTML into lead drafts (one per job card). */
export function parseLinkedInAlert(html: string): LeadDraft[] {
  const byId = new Map<string, LeadDraft>();

  // One chunk per job card (skip the header chunk before the first marker).
  const chunks = html
    .split(/data-test-id="(?:job-card|email-generic-section-JOBS_POSTING_SECTION-job-cards)"/i)
    .slice(1);

  for (const chunk of chunks) {
    const idMatch = chunk.match(/\/jobs\/view\/(\d+)/);
    if (!idMatch) continue;
    const id = idMatch[1];
    if (byId.has(id)) continue;

    // Title: the bold anchor (digest) or bold div inside the card link
    // (generic); otherwise the first job link with text (the "jobs similar
    // to…" reminder styles it text-color-brand, not bold).
    const title =
      firstMatch(chunk, /<(?:a|div)\b[^>]*font-bold[^>]*>([\s\S]*?)<\/(?:a|div)>/i) ||
      firstJobLinkText(chunk);
    if (!title) continue;

    // "Company · City (Remote)" line.
    const metaLine = firstMatch(
      chunk,
      /<p\b[^>]*text-system-gray-100[^>]*>([\s\S]*?)<\/p>/i,
    );
    let company = "";
    let location = "";
    if (metaLine) {
      const parts = metaLine.split("·").map((s) => s.trim());
      company = parts[0] ?? "";
      location = parts.slice(1).join(" · ").trim();
    }
    const remote = /\(remote\)/i.test(location);

    // Badges (Actively recruiting / Top applicant / Easy Apply / …).
    const tags: string[] = [];
    const tagRe = /job-card-flavor__detail[^>]*>([\s\S]*?)<\/p>/gi;
    let t: RegExpExecArray | null;
    while ((t = tagRe.exec(chunk)) !== null) {
      const tag = stripTags(t[1]);
      if (tag) tags.push(tag);
    }

    byId.set(id, {
      linkedinJobId: id,
      title,
      company,
      location,
      remote,
      // LinkedIn can repeat a badge (e.g. "Easy Apply") within a card — dedupe.
      tags: [...new Set(tags)],
      postedRelative: "",
      canonicalJobUrl: `https://www.linkedin.com/jobs/view/${id}`,
    });
  }

  return [...byId.values()];
}
