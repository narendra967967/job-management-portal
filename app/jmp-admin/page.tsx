import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";

// Admin entry point: an admin session goes to the dashboard, everyone else to login.
export default async function AdminIndexPage() {
  const session = await authAdmin.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | undefined)?.role;
  redirect(role === "admin" ? "/jmp-admin/dashboard" : "/jmp-admin/login");
}
