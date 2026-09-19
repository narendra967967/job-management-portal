import { LeadsBrowser } from "@/components/leads/leads-browser";

export default function ArchivePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h1 className="text-lg font-semibold tracking-tight">Archive</h1>
        <p className="hidden text-sm text-muted-foreground sm:block">
          Stale, closed, and discarded leads.
        </p>
      </div>
      <LeadsBrowser scope="archive" />
    </div>
  );
}
