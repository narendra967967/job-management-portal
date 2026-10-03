import { Tag } from "lucide-react";

// Plans & Pricing (Sales & Revenue). Scaffold only — the real content (plan
// tiers, prices, billing cycles, features) is decided and built later.
export default function AdminPlansPage() {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center rounded-2xl border border-dashed bg-card/40 p-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Tag className="size-7" aria-hidden />
      </span>
      <h2 className="mt-5 text-sm font-medium">No plans yet</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Plans and pricing will be set up here.
      </p>
    </div>
  );
}
