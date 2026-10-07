"use client";

// Admin panel shell — grouped collapsible sidebar + top bar. Admin-only; does
// NOT reuse any user-dashboard component so admin styling evolves independently.
// All configuration + the admin's account live on one Settings page, reached from
// the sidebar footer.

import { useEffect, useState } from "react";
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
  LifeBuoy,
  ChevronDown,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { adminSignOut } from "@/lib/auth-admin-client";

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

const SETTINGS_HREF = "/jmp-admin/settings";

interface Admin {
  name: string;
  email: string;
}

const GROUPS: Group[] = [
  { label: "Overview", items: [{ href: "/jmp-admin/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "People and Tickets",
    items: [
      { href: "/jmp-admin/users", label: "Users", icon: Users },
      { href: "/jmp-admin/tickets", label: "Tickets", icon: LifeBuoy },
    ],
  },
  {
    // One parent for everything money-related: selling, orders, revenue, and
    // the marketing levers that drive it. All post-payment-integration (soon).
    label: "Sales & Revenue",
    items: [
      { href: "/jmp-admin/plans", label: "Plans & Pricing", icon: Tag },
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
];

const TITLES: Record<string, string> = {
  "/jmp-admin/dashboard": "Dashboard",
  "/jmp-admin/users": "Users",
  "/jmp-admin/tickets": "Tickets",
  "/jmp-admin/plans": "Plans & Pricing",
  "/jmp-admin/settings": "Settings",
};

function isActive(pathname: string, href?: string) {
  if (!href) return false;
  return pathname === href || pathname.startsWith(href + "/");
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/api/branding/logo" alt="Logo" width={32} height={32} className="size-8 shrink-0 rounded-full object-cover" />
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

function NavGroup({
  group,
  pathname,
  open,
  onToggle,
}: {
  group: Group;
  pathname: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
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

function UserFooter({ pathname, admin, onLogout }: { pathname: string; admin: Admin; onLogout: () => void }) {
  const settingsActive = isActive(pathname, SETTINGS_HREF);
  return (
    <div className="mt-4 space-y-1 border-t border-slate-800 pt-3">
      <span className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500">
        <BookOpen className="size-4 shrink-0" aria-hidden />
        Knowledge base
        <span className="ml-auto rounded-full bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400">soon</span>
      </span>
      <Link
        href={SETTINGS_HREF}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          settingsActive ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60 hover:text-white",
        )}
      >
        <Settings className="size-4 shrink-0" aria-hidden />
        Settings
      </Link>
      <div className="flex items-center gap-2 rounded-lg px-2 py-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {(admin.name || "A").charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-xs font-medium text-white">{admin.name}</p>
          <p className="truncate text-[10px] text-slate-400">{admin.email}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          aria-label="Log out"
          className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function AdminShell({
  children,
  admin = { name: "Admin", email: "" },
}: {
  children: React.ReactNode;
  admin?: Admin;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const title = TITLES[pathname] ?? "Admin";

  // Accordion: one group open at a time. The group holding the active page opens
  // on load and whenever navigation moves into it; opening another closes the rest.
  const activeGroup = GROUPS.find((g) => g.items.some((it) => isActive(pathname, it.href)))?.label ?? null;
  const [openGroup, setOpenGroup] = useState<string | null>(activeGroup);
  useEffect(() => {
    setOpenGroup(activeGroup);
  }, [activeGroup]);
  const mobileLinks: Item[] = [
    ...GROUPS.flatMap((g) => g.items).filter((i) => i.href && !i.soon),
    { href: SETTINGS_HREF, label: "Settings", icon: Settings },
  ];

  async function logout() {
    try {
      await adminSignOut();
    } finally {
      router.push("/jmp-admin/login");
    }
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-muted/30 md:flex-row">
      {/* Desktop sidebar — fixed; scrolls on its own only if it overflows. */}
      <aside className="hidden w-60 shrink-0 flex-col justify-between overflow-y-auto bg-slate-900 p-4 md:flex">
        <div className="flex flex-col gap-5">
          <Brand />
          <div className="flex flex-col gap-3">
            {GROUPS.map((g) => (
              <NavGroup
                key={g.label}
                group={g}
                pathname={pathname}
                open={openGroup === g.label}
                onToggle={() => setOpenGroup((cur) => (cur === g.label ? null : g.label))}
              />
            ))}
          </div>
        </div>
        <UserFooter pathname={pathname} admin={admin} onLogout={logout} />
      </aside>

      {/* Mobile top bar + nav row */}
      <div className="flex shrink-0 items-center justify-between bg-slate-900 px-4 py-3 md:hidden">
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
      <div className="flex shrink-0 gap-1 overflow-x-auto bg-slate-900/95 px-3 pb-3 md:hidden">
        {mobileLinks.map((it) => {
          const Icon = it.icon;
          const active = isActive(pathname, it.href);
          return (
            <Link
              key={it.href}
              href={it.href!}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium",
                active ? "bg-slate-800 text-white" : "text-slate-300",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {it.label}
            </Link>
          );
        })}
      </div>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-3 border-b bg-card px-4 py-3 md:px-6">
          <h1 className="text-base font-semibold md:text-lg">{title}</h1>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
