import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/admin/admin-shell";

// Authenticated admin panel. Enforced server-side on every page: a valid session
// AND role = admin, else back to the admin login.
export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await authAdmin.api.getSession({ headers: await headers() });
  const u = session?.user as { name?: string; email?: string; role?: string } | undefined;
  if (!u || u.role !== "admin") redirect("/jmp-admin/login");

  return (
    <AdminShell admin={{ name: u.name ?? "Admin", email: u.email ?? "" }}>
      {children}
    </AdminShell>
  );
}
