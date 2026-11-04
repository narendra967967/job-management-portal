"use client";

// Knowledge base tabs: Ask · Articles · Unanswered · History.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, History, HelpCircle, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = "/jmp-admin/knowledge-base";

const TABS = [
  { href: BASE, label: "Ask", icon: MessageSquare, exact: true },
  { href: `${BASE}/articles`, label: "Articles", icon: FileText },
  { href: `${BASE}/unanswered`, label: "Unanswered", icon: HelpCircle },
  { href: `${BASE}/history`, label: "History", icon: History },
];

export function KbNav({ openQuestions }: { openQuestions: number }) {
  const pathname = usePathname();
  return (
    // Phones: labels only, so all four tabs fit on one row.
    <nav aria-label="Knowledge base" className="flex w-full min-w-0 gap-1">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-1.5 text-sm font-medium whitespace-nowrap transition-colors sm:min-h-9 sm:flex-none sm:gap-2 sm:px-3",
              active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="hidden size-4 sm:block" aria-hidden />
            {t.label}
            {t.label === "Unanswered" && openQuestions > 0 && (
              <span className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
                {openQuestions}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
