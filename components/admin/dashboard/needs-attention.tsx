"use client";

// Top of the dashboard: only what needs the admin right now. Always shown and
// can't be hidden (spec). Critical first, then warnings, then the rest.

import Link from "next/link";
import { AlertOctagon, AlertTriangle, CheckCircle2, ChevronRight, Info } from "lucide-react";
import { Card } from "@/components/admin/ui/card";
import type { AttentionItem, Severity } from "@/lib/admin/dashboard-model";
import { cn } from "@/lib/utils";

const ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

const LOOK: Record<Severity, { icon: typeof Info; tone: string; label: string }> = {
  critical: { icon: AlertOctagon, tone: "text-destructive", label: "Urgent" },
  warning: { icon: AlertTriangle, tone: "text-status-shortlisted-foreground", label: "Soon" },
  info: { icon: Info, tone: "text-primary", label: "For your information" },
};

export function NeedsAttention({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <Card className="flex min-h-11 items-center gap-2 px-4 py-3 text-sm">
        <CheckCircle2 className="size-4 shrink-0 text-status-applied-foreground" aria-hidden />
        <span className="font-medium">All clear.</span>
        <span className="text-muted-foreground">Nothing needs you right now.</span>
      </Card>
    );
  }
  const sorted = [...items].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  return (
    <Card className="p-2">
      <h2 className="px-2 pt-1 pb-1.5 text-sm font-semibold">
        Needs attention <span className="font-normal text-muted-foreground">({items.length})</span>
      </h2>
      <ul className="grid gap-x-2 lg:grid-cols-2 2xl:grid-cols-3">
        {sorted.map((a) => {
          const { icon: Icon, tone, label } = LOOK[a.severity];
          return (
            <li key={a.key}>
              <Link href={a.href} className="flex min-h-11 items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60">
                <Icon className={cn("size-4 shrink-0", tone)} aria-label={label} />
                <span className="min-w-0 flex-1">{a.text}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
