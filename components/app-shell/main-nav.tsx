"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutGrid,
  Users,
  MessageSquare,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Logo } from "@/components/app-shell/logo";
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
              "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-gradient-to-r from-primary/12 to-primary/[0.03] font-semibold text-primary before:absolute before:top-1/2 before:left-0 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-primary"
                : "font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
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
          "relative mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
          active
            ? "bg-gradient-to-r from-primary/12 to-primary/[0.03] font-semibold text-primary before:absolute before:top-1/2 before:left-0 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-primary"
            : "font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
        )}
      >
        <Settings className="size-5 shrink-0" aria-hidden />
        Settings
      </Link>
      <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.56_0.2_305)] text-[11px] font-semibold text-primary-foreground shadow-sm">
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
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.56_0.2_305)] text-[11px] font-semibold text-primary-foreground shadow-sm"
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

/** Hamburger + slide-in sidebar drawer — mobile only (below md). */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll + close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          // Portalled to <body> so `fixed` isn't trapped by the header's
          // backdrop-filter containing block (which clamped it to the header).
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              aria-label="Close menu"
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/40"
            />
            <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r border-sidebar-border bg-sidebar shadow-xl">
              <div className="flex items-center justify-between border-b border-sidebar-border p-4">
                <Logo />
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              {/* Close when any link inside is tapped (covers same-route taps too). */}
              <div
                className="flex min-h-0 flex-1 flex-col overflow-y-auto"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("a")) setOpen(false);
                }}
              >
                <SidebarNav />
                <SidebarFooter />
              </div>
            </aside>
          </div>,
          document.body,
        )}
    </div>
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
