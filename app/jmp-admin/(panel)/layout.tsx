import { AdminShell } from "@/components/admin/admin-shell";

// Layout for the authenticated admin panel. (Auth enforcement is a backend
// TODO — this module is UI-first; today the pages are reachable directly.)
export default function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
