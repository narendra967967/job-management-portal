import { LeadsBrowser } from "@/components/leads/leads-browser";

export default function OutreachedPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h1 className="text-lg font-semibold tracking-tight">Outreached</h1>
        <p className="hidden text-sm text-muted-foreground sm:block">
          Open jobs where you&apos;ve sent a message.
        </p>
      </div>
      <LeadsBrowser scope="outreached" />
    </div>
  );
}
