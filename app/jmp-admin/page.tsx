import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Admin entry point: an admin session goes to the dashboard, everyone else to login.
export default async function AdminIndexPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | undefined)?.role;
  redirect(role === "admin" ? "/jmp-admin/dashboard" : "/jmp-admin/login");
}
