// Registry of built-in job-alert readers, keyed by the allowed sender's
// "Reader" setting (admin Settings → Email forwarding). Adding a site = one
// parser file + an entry here + the reader value in the inbound_parser enum.

import type { InboundParser } from "@/lib/email-intake-model";
import type { LeadDraft } from "@/lib/lead-draft";
import { parseLinkedInAlert } from "@/lib/linkedin-parser";
import { parseNaukriAlert } from "@/lib/naukri-parser";
import { parseTimesJobsAlert } from "@/lib/timesjobs-parser";
import { parseGlassdoorAlert } from "@/lib/glassdoor-parser";

export const ALERT_PARSERS: Record<Exclude<InboundParser, "none">, (html: string) => LeadDraft[]> = {
  linkedin: parseLinkedInAlert,
  naukri: parseNaukriAlert,
  timesjobs: parseTimesJobsAlert,
  glassdoor: parseGlassdoorAlert,
};
