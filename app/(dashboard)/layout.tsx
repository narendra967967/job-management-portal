import { Search } from "lucide-react";
import { Logo } from "@/components/app-shell/logo";
import {
  SidebarNav,
  SidebarFooter,
  AccountMenu,
  BottomNav,
} from "@/components/app-shell/main-nav";
import { NotificationsMenu, TopBarStats } from "@/components/app-shell/top-bar";
import { Input } from "@/components/ui/input";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="border-b border-sidebar-border p-4">
          <Logo />
        </div>
        <SidebarNav />
        <SidebarFooter />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top app bar */}
        <header className="sticky top-0 z-30 border-b bg-card/70 shadow-[0_1px_2px_-1px_oklch(0.51_0.24_277_/_0.12)] backdrop-blur-md">
          <div className="flex items-center gap-2 px-4 py-2.5 md:gap-3 md:px-6">
            <div className="md:hidden">
              <Logo showName={false} />
            </div>
            <div className="relative w-36 sm:w-56 md:w-72">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                placeholder="Search company or title"
                aria-label="Search leads"
                className="h-9 pl-9"
              />
            </div>
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
              <TopBarStats className="hidden sm:flex" />
              <NotificationsMenu />
              {/* Account (Settings / Log out) — mobile only; desktop uses the sidebar footer. */}
              <div className="md:hidden">
                <AccountMenu />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pt-4 pb-24 md:px-6 md:pt-6 md:pb-8">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
