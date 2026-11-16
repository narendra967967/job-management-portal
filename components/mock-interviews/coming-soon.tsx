import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// A Mock interviews page that isn't open yet. Admin's Open / Coming soon
// switches (docs/interview-prep/spec.md, section 4) arrive in R1.3/R1.4; until
// then every Mock interviews page shows this.

export function ComingSoon({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <div className="rounded-xl border bg-card p-6 text-center sm:p-10">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-6" aria-hidden />
        </span>
        <Badge variant="secondary" className="mt-4">
          Coming soon
        </Badge>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
