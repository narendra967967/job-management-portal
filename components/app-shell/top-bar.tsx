"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Bell, Clock, Sparkles, Search } from "lucide-react";
import { useLeads, useReminders, useNotifications, useProfile, markNotificationsRead } from "@/lib/mock-store";
import { useSearchQuery, setSearchQuery } from "@/lib/search-store";
import { Input } from "@/components/ui/input";
import { PlanBadge } from "@/components/ui/plan-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Search box that filters the Leads list (jumps to /leads when typing). */
export function TopBarSearch() {
  const query = useSearchQuery();
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div className="relative w-36 sm:w-56 md:w-72">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={query}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          if (e.target.value && pathname !== "/leads") router.push("/leads");
        }}
        placeholder="Search company or title"
        aria-label="Search leads"
        className="h-9 pl-9"
      />
    </div>
  );
}

/** The user's current plan as a tinted pill; links to Settings. Hidden when no plan. */
export function PlanChip({ className }: { className?: string }) {
  const plan = useProfile().plan;
  if (!plan) return null;
  return (
    <Link href="/settings" aria-label={`Your plan: ${plan.name}`} className={cn("shrink-0", className)}>
      <PlanBadge name={plan.name} accent={plan.accent} />
    </Link>
  );
}

/** Compact key numbers in the top bar. */
export function TopBarStats({ className }: { className?: string }) {
  const newCount = useLeads().filter((l) => l.status === "new").length;
  const dueCount = useReminders().filter((r) => r.outcome === "pending").length;
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Link
        href="/leads"
        className="inline-flex items-center gap-1.5 rounded-lg border border-status-new/40 bg-status-new/40 px-2.5 py-1.5 text-xs font-medium text-status-new-foreground transition-colors hover:bg-status-new/70"
      >
        <span>New</span>
        <span className="tabular-nums font-semibold">{newCount}</span>
      </Link>
      <Link
        href="/reminders"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
          dueCount > 0
            ? "border-status-reviewing/50 bg-status-reviewing/60 text-status-reviewing-foreground hover:bg-status-reviewing"
            : "border-border bg-card text-muted-foreground hover:bg-muted",
        )}
      >
        <span>Due</span>
        <span className="tabular-nums font-semibold">{dueCount}</span>
      </Link>
    </div>
  );
}

/** Bell with a dropdown of notifications; each opens its lead. */
const MAX_NOTIFICATIONS = 5;

export function NotificationsMenu() {
  const router = useRouter();
  const notifications = useNotifications();
  const unread = notifications.filter((n) => !n.read).length;
  // Only ever show the five most recent; the rest live on their pages.
  const top = notifications.slice(0, MAX_NOTIFICATIONS);

  function open(n: (typeof notifications)[number]) {
    if (n.leadId) router.push(`/leads/${n.leadId}`);
    else if (n.href) router.push(n.href);
  }

  return (
    <DropdownMenu onOpenChange={(o) => o && markNotificationsRead()}>
      <DropdownMenuTrigger
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        className="relative flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground tabular-nums">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[92vw]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            You&apos;re all caught up.
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {top.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="items-start gap-2.5 py-2"
                onClick={() => open(n)}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md",
                    n.kind === "reminder-due"
                      ? "bg-status-reviewing text-status-reviewing-foreground"
                      : n.kind === "system"
                        ? "bg-primary/10 text-primary"
                        : "bg-ai-muted text-ai",
                  )}
                >
                  {n.kind === "reminder-due" ? (
                    <Clock className="size-3.5" aria-hidden />
                  ) : n.kind === "system" ? (
                    <Bell className="size-3.5" aria-hidden />
                  ) : (
                    <Sparkles className="size-3.5" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{n.title}</span>
                  <span className="block line-clamp-2 text-xs text-muted-foreground">
                    {n.detail}
                  </span>
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        {unread > top.length && (
          <p className="px-2 pt-1 text-center text-[11px] text-muted-foreground">
            +{unread - top.length} more
          </p>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="justify-center text-sm font-medium text-primary"
          onClick={() => router.push("/leads")}
        >
          View all leads
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
