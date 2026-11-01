import { LeadsBrowser } from "@/components/leads/leads-browser";

export default function ReadyPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h1 className="text-lg font-semibold tracking-tight">Ready to action</h1>
        <p className="hidden text-sm text-muted-foreground sm:block">
          Shortlisted and applied jobs with a description and a contact, where nothing&apos;s been sent yet.
        </p>
      </div>
      <LeadsBrowser scope="ready" />
    </div>
  );
}
