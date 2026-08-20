"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Clock, Sparkles } from "lucide-react";
import { mockLeads, mockNotifications, mockReminders } from "@/lib/mock-data";
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

const newCount = mockLeads.filter((l) => l.status === "new").length;
const dueCount = mockReminders.filter((r) => r.outcome === "pending").length;

/** Compact key numbers in the top bar. */
export function TopBarStats({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Link
        href="/leads"
        className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
      >
        <span className="text-muted-foreground">New</span>
        <span className="tabular-nums text-status-new-foreground">
          {newCount}
        </span>
      </Link>
      <Link
        href="/reminders"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-muted",
          dueCount > 0
            ? "border-status-reviewing bg-status-reviewing text-status-reviewing-foreground"
            : "bg-card text-muted-foreground",
        )}
      >
        <span className={dueCount > 0 ? "" : "text-muted-foreground"}>Due</span>
        <span className="tabular-nums">{dueCount}</span>
      </Link>
    </div>
  );
}

/** Bell with a dropdown of notifications; each opens its lead. */
export function NotificationsMenu() {
  const router = useRouter();
  const unread = mockNotifications.filter((n) => n.unread).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        className="relative flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground tabular-nums">
            {unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[92vw]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {mockNotifications.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            You&apos;re all caught up.
          </p>
        ) : (
          mockNotifications.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="items-start gap-2.5 py-2"
              onClick={() => router.push(`/leads/${n.leadId}`)}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md",
                  n.kind === "reminder-due"
                    ? "bg-status-reviewing text-status-reviewing-foreground"
                    : "bg-ai-muted text-ai",
                )}
              >
                {n.kind === "reminder-due" ? (
                  <Clock className="size-3.5" aria-hidden />
                ) : (
                  <Sparkles className="size-3.5" aria-hidden />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{n.title}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {n.time}
                  </span>
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {n.detail}
                </span>
              </span>
            </DropdownMenuItem>
          ))
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
