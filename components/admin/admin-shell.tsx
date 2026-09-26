"use client";

// Admin panel shell — sidebar + top bar. This is admin-only and intentionally
// does NOT reuse any user-dashboard component, so admin styling can evolve
// independently. Dark sidebar distinguishes the admin area from the user app.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Settings,
  Users,
  ScrollText,
  Sparkles,
  Shield,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: "/jmp-admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jmp-admin/settings", label: "Settings", icon: Settings },
];

// Placeholders for features to be added later (non-clickable for now).
const SOON: { label: string; icon: LucideIcon }[] = [
  { label: "Users", icon: Users },
  { label: "AI", icon: Sparkles },
  { label: "Activity log", icon: ScrollText },
];

const TITLES: Record<string, string> = {
  "/jmp-admin": "Dashboard",
  "/jmp-admin/settings": "Settings",
};

function isActive(pathname: string, href: string) {
  return href === "/jmp-admin"
    ? pathname === "/jmp-admin"
    : pathname === href || pathname.startsWith(href + "/");
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Shield className="size-4" aria-hidden />
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-white">JMP Admin</p>
        <p className="text-[10px] text-slate-400">Control panel</p>
      </div>
    </div>
  );
}

function NavLinks({ pathname }: { pathname: string }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-slate-800 text-white before:mr-[-4px] before:h-4 before:w-1 before:rounded-full before:bg-primary"
                : "text-slate-300 hover:bg-slate-800/60 hover:text-white",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
      <p className="mt-3 px-3 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
        Coming soon
      </p>
      {SOON.map(({ label, icon: Icon }) => (
        <span
          key={label}
          className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500"
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          {label}
          <span className="ml-auto rounded-full bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400">
            soon
          </span>
        </span>
      ))}
    </nav>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const title = TITLES[pathname] ?? "Admin";

  function logout() {
    // TODO: clear the admin session when auth is wired; UI-only for now.
    router.push("/jmp-admin/login");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-muted/30 md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col justify-between bg-slate-900 p-4 md:flex">
        <div className="flex flex-col gap-6">
          <Brand />
          <NavLinks pathname={pathname} />
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-white"
        >
          <LogOut className="size-4" aria-hidden />
          Log out
        </button>
      </aside>

      {/* Mobile top bar */}
      <div className="flex items-center justify-between gap-2 bg-slate-900 px-4 py-3 md:hidden">
        <Brand />
        <button
          type="button"
          onClick={logout}
          aria-label="Log out"
          className="flex size-9 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </div>
      {/* Mobile nav row */}
      <div className="flex gap-1 overflow-x-auto bg-slate-900/95 px-3 pb-3 md:hidden">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium",
                active ? "bg-slate-800 text-white" : "text-slate-300",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-card px-4 py-3 md:px-6">
          <h1 className="text-base font-semibold md:text-lg">{title}</h1>
          <span className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:block">
              admin@jmp
            </span>
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              A
            </span>
          </span>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
