"use client";

// Admin panel shell — grouped collapsible sidebar + top bar. Admin-only; does
// NOT reuse any user-dashboard component so admin styling evolves independently.

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Tag,
  Repeat,
  CreditCard,
  TrendingUp,
  Ticket,
  Megaphone,
  Gift,
  Inbox,
  ScrollText,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Clock,
  Mail,
  Wallet,
  Receipt,
  Lock,
  ChevronDown,
  Shield,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/admin/ui/dropdown-menu";

interface Item {
  href?: string;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
}
interface Group {
  label: string;
  items: Item[];
}

const GROUPS: Group[] = [
  { label: "Overview", items: [{ href: "/jmp-admin/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "People & Content",
    items: [
      { href: "/jmp-admin/users", label: "Users", icon: Users },
      { label: "Knowledge base", icon: BookOpen, soon: true },
    ],
  },
  {
    // One parent for everything money-related: selling, orders, revenue, and
    // the marketing levers that drive it. All post-payment-integration (soon).
    label: "Sales & Revenue",
    items: [
      { label: "Plans & Pricing", icon: Tag, soon: true },
      { label: "Subscriptions", icon: Repeat, soon: true },
      { label: "Orders & Payments", icon: CreditCard, soon: true },
      { label: "Revenue", icon: TrendingUp, soon: true },
      { label: "Coupons & Discounts", icon: Ticket, soon: true },
      { label: "Campaigns", icon: Megaphone, soon: true },
      { label: "Referrals", icon: Gift, soon: true },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Gmail health", icon: Inbox, soon: true },
      { label: "Activity log", icon: ScrollText, soon: true },
    ],
  },
  {
    label: "Configuration",
    items: [
      { label: "General", icon: SlidersHorizontal, soon: true },
      { label: "Email / SMTP", icon: Mail, soon: true },
      { label: "Payments", icon: Wallet, soon: true },
      { label: "Taxes & GST", icon: Receipt, soon: true },
      { label: "AI & prompts", icon: Sparkles, soon: true },
      { label: "Cron & schedule", icon: Clock, soon: true },
      { label: "Security", icon: Lock, soon: true },
    ],
  },
];

const TITLES: Record<string, string> = {
  "/jmp-admin/dashboard": "Dashboard",
  "/jmp-admin/users": "Users",
  "/jmp-admin/settings": "Account",
};

function isActive(pathname: string, href?: string) {
  if (!href) return false;
  return pathname === href || pathname.startsWith(href + "/");
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

function ItemRow({ item, pathname }: { item: Item; pathname: string }) {
  const Icon = item.icon;
  if (item.soon || !item.href) {
    return (
      <span className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500">
        <Icon className="size-4 shrink-0" aria-hidden />
        {item.label}
        <span className="ml-auto rounded-full bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400">soon</span>
      </span>
    );
  }
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60 hover:text-white",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {item.label}
    </Link>
  );
}

function NavGroup({ group, pathname }: { group: Group; pathname: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase transition-colors hover:text-slate-300"
      >
        <span>{group.label}</span>
        <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} aria-hidden />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {group.items.map((it) => (
            <ItemRow key={it.label} item={it} pathname={pathname} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const title = TITLES[pathname] ?? "Admin";
  const mobileLinks = GROUPS.flatMap((g) => g.items).filter((i) => i.href && !i.soon);

  function logout() {
    // TODO: clear the admin session when auth is wired; UI-only for now.
    router.push("/jmp-admin/login");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-muted/30 md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col justify-between overflow-y-auto bg-slate-900 p-4 md:flex">
        <div className="flex flex-col gap-5">
          <Brand />
          <div className="flex flex-col gap-3">
            {GROUPS.map((g) => (
              <NavGroup key={g.label} group={g} pathname={pathname} />
            ))}
          </div>
        </div>
      </aside>

      {/* Mobile top bar + nav row */}
      <div className="flex items-center bg-slate-900 px-4 py-3 md:hidden">
        <Brand />
      </div>
      <div className="flex gap-1 overflow-x-auto bg-slate-900/95 px-3 pb-3 md:hidden">
        {mobileLinks.map((it) => {
          const Icon = it.icon;
          const active = isActive(pathname, it.href);
          return (
            <Link key={it.href} href={it.href!} className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium", active ? "bg-slate-800 text-white" : "text-slate-300")}>
              <Icon className="size-3.5" aria-hidden />
              {it.label}
            </Link>
          );
        })}
      </div>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-card px-4 py-3 md:px-6">
          <h1 className="text-base font-semibold md:text-lg">{title}</h1>
          <DropdownMenu>
            <DropdownMenuTrigger className="ml-auto flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="hidden text-sm text-muted-foreground sm:block">admin@jmp</span>
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">A</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push("/jmp-admin/settings")}>
                <Settings /> Account settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onClick={logout}>
                <LogOut /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
