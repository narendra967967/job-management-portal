import { Bell, Search } from "lucide-react";
import { Logo } from "@/components/app-shell/logo";
import { SidebarNav, BottomNav } from "@/components/app-shell/main-nav";
import { Input } from "@/components/ui/input";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-card md:flex">
        <div className="border-b p-4">
          <Logo />
        </div>
        <SidebarNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top app bar */}
        <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 md:px-6">
            <div className="md:hidden">
              <Logo showName={false} />
            </div>
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                placeholder="Search company or title"
                aria-label="Search leads"
                className="pl-9"
              />
            </div>
            <button
              type="button"
              aria-label="Notifications"
              className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Bell className="size-5" aria-hidden />
            </button>
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
