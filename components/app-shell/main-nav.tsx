"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutGrid,
  Users,
  MessageSquare,
  Bell,
  Settings,
  LogOut,
} from "lucide-react";
import { mockProfile } from "@/lib/mock-data";
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

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
}

const navItems = [
  { href: "/leads", label: "Leads", icon: LayoutGrid },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/outreach", label: "Outreach", icon: MessageSquare },
  { href: "/reminders", label: "Reminders", icon: Bell },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/** Persistent left sidebar — desktop only (md+). */
export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-3">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Sidebar footer — desktop: Settings link + profile + logout. */
export function SidebarFooter() {
  const pathname = usePathname();
  const active = isActive(pathname, "/settings");
  return (
    <div className="mt-auto border-t p-3">
      <Link
        href="/settings"
        className={cn(
          "mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Settings className="size-5 shrink-0" aria-hidden />
        Settings
      </Link>
      <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
          {initials(mockProfile.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{mockProfile.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {mockProfile.email}
          </p>
        </div>
        <Link
          href="/"
          aria-label="Log out"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

/** Account menu — mobile top bar: avatar → Settings / Log out. */
export function AccountMenu() {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary"
      >
        {initials(mockProfile.name)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate">
            {mockProfile.name}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings className="size-4" aria-hidden />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/")}>
          <LogOut className="size-4" aria-hidden />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Bottom tab bar — mobile only (below md). */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-card md:hidden">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
