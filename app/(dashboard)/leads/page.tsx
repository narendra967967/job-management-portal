import { LeadsBrowser } from "@/components/leads/leads-browser";
import { mockLeads } from "@/lib/mock-data";

export default function LeadsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-medium">Leads</h1>
        <p className="text-sm text-muted-foreground">
          Job alerts captured from your inbox.
        </p>
      </div>
      <LeadsBrowser leads={mockLeads} />
    </div>
  );
}
