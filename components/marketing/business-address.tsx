// The business name and postal address (from admin Billing), shown wherever
// we give public contact details next to the support email.

import { MapPin } from "lucide-react";
import type { PublicBusiness } from "@/lib/billing-data";
import { cn } from "@/lib/utils";

export function BusinessAddress({ business, className }: { business: PublicBusiness; className?: string }) {
  return (
    <address className={cn("flex items-start gap-2 text-sm not-italic", className)}>
      <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <span>
        <span className="block font-medium">{business.name}</span>
        {business.addressLines.map((line, i) => (
          <span key={i} className="block text-muted-foreground">
            {line}
          </span>
        ))}
      </span>
    </address>
  );
}
