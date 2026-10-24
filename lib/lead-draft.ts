// What every job-alert reader (LinkedIn, Naukri, TimesJobs, …) produces for one
// job card. Pure type — lib/lead-ingest.ts turns drafts into leads.

export interface LeadDraft {
  /** The per-user "same job?" key (see lib/job-key.ts), stored in
   *  job_leads.linkedin_job_id. */
  jobKey: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  tags: string[];
  postedRelative: string;
  canonicalJobUrl: string;
}
