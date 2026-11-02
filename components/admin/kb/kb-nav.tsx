"use client";

// Knowledge base tabs: Ask · Articles · Unanswered · History.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, History, HelpCircle, MessageSquare, RotateCcw } from "lucide-react";
import { useKb, resetSample } from "@/lib/kb-mock";
import { cn } from "@/lib/utils";

const BASE = "/jmp-admin/knowledge-base";

const TABS = [
  { href: BASE, label: "Ask", icon: MessageSquare, exact: true },
  { href: `${BASE}/articles`, label: "Articles", icon: FileText },
  { href: `${BASE}/unanswered`, label: "Unanswered", icon: HelpCircle },
  { href: `${BASE}/history`, label: "History", icon: History },
];

export function KbNav() {
  const pathname = usePathname();
  const { questions } = useKb();
  const open = questions.filter((q) => q.status === "open").length;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Phones: tabs get their own full row, labels only, so all four fit. */}
      <nav aria-label="Knowledge base" className="order-2 flex w-full min-w-0 gap-1 sm:order-1 sm:w-auto sm:flex-1">
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
              {t.label === "Unanswered" && open > 0 && (
                <span className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
                  {open}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      {/* PHASE 1: everything here is sample data in this browser. */}
      <div className="order-1 ml-auto flex items-center gap-1 sm:order-2">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">Sample data</span>
        <button
          type="button"
          onClick={resetSample}
          title="Reset sample data"
          aria-label="Reset sample data"
          className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground sm:size-8"
        >
          <RotateCcw className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
