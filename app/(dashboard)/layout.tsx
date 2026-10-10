import { Logo } from "@/components/app-shell/logo";
import {
  SidebarNav,
  SidebarFooter,
  MobileNav,
  BottomNav,
} from "@/components/app-shell/main-nav";
import {
  NotificationsMenu,
  TopBarStats,
  TopBarSearch,
} from "@/components/app-shell/top-bar";
import { AutoSync } from "@/components/app-shell/auto-sync";
import { Toaster } from "@/components/ui/toast";
import {
  AddLeadProvider,
  HeaderAddLeadButton,
  AddLeadFab,
} from "@/components/leads/add-lead-dialog";
import { ContactSupportProvider, SupportIconButton } from "@/components/support/contact-support";
import { redirect } from "next/navigation";
import { getSessionUser, accessState } from "@/lib/current-user";
import { guardMaintenance } from "@/lib/maintenance";
import { getAppName } from "@/lib/branding";
import { loadWorkspace } from "@/lib/queries";
import { WorkspaceProvider } from "@/lib/workspace-provider";

// Per-user, session-gated routes — never statically prerendered (no DB at build).
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Maintenance mode takes the whole user side offline (admin panel stays up).
  await guardMaintenance();
  // Gate on the admin-managed account state: deactivated / expired users can sign
  // in but don't reach the dashboard.
  const u = await getSessionUser();
  if (!u) redirect("/");
  const state = accessState(u);
  if (state === "deactivated") redirect("/deactivated");
  if (state === "expired") redirect("/renew");
  const [workspace, appName] = await Promise.all([loadWorkspace(u.id), getAppName()]);
  return (
    // App shell: full-height flex. On mobile the header + bottom nav are
    // fixed-height flex children and only <main> scrolls, so the bottom nav is
    // always pinned to the visible bottom (no reliance on position:fixed).
    <WorkspaceProvider initial={workspace}>
    <AutoSync />
    <ContactSupportProvider>
    <AddLeadProvider>
    <div className="flex h-dvh flex-col overflow-hidden bg-background md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar md:flex">
        <div className="border-b border-sidebar-border p-4">
          <Logo name={appName} />
        </div>
        <SidebarNav />
        <SidebarFooter />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top app bar */}
        <header className="shrink-0 border-b bg-card/70 shadow-[0_1px_2px_-1px_oklch(0.51_0.24_277_/_0.12)] backdrop-blur-md">
          <div className="flex items-center gap-2 px-4 py-2.5 md:gap-3 md:px-6">
            <MobileNav name={appName} />
            <div className="md:hidden">
              <Logo showName={false} name={appName} />
            </div>
            <TopBarSearch />
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
              <TopBarStats className="hidden sm:flex" />
              <HeaderAddLeadButton />
              <SupportIconButton />
              <NotificationsMenu />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pt-4 pb-6 md:px-6 md:pt-6 md:pb-8">
          {children}
        </main>

        {/* Mobile bottom nav — a flex child pinned below <main>, not fixed. */}
        <BottomNav />
      </div>

      {/* Mobile-only floating "Add lead" button (above the bottom nav). */}
      <AddLeadFab />
      </div>
      <Toaster />
    </AddLeadProvider>
    </ContactSupportProvider>
    </WorkspaceProvider>
  );
}
