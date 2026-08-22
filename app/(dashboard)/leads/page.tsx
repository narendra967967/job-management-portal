import { LeadsBrowser } from "@/components/leads/leads-browser";
import { mockLeads } from "@/lib/mock-data";

export default function LeadsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h1 className="text-lg font-semibold tracking-tight">Leads</h1>
        <p className="hidden text-sm text-muted-foreground sm:block">
          Job alerts captured from your inbox.
        </p>
      </div>
      <LeadsBrowser leads={mockLeads} />
    </div>
  );
}
