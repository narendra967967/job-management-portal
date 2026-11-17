import { Clock } from "lucide-react";

// Shown in production while the Mock interviews admin screens are still on
// sample data (PHASE R1.3). R1.4 replaces it with the real pages.
export function AdminComingSoon({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border bg-card p-6 text-center">
      <Clock className="mx-auto size-8 text-muted-foreground" aria-hidden />
      <h2 className="mt-3 text-base font-semibold">{title}: coming soon</h2>
    </div>
  );
}
