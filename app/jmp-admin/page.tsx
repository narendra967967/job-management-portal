import { redirect } from "next/navigation";

// Admin entry point. Routes to the dashboard when there's a session, otherwise
// to login. Session wiring is deferred (backend phase) — until then there's no
// admin session, so this lands on /jmp-admin/login. When auth is added, replace
// the stub below with the real session lookup; the redirect logic stays.
export default async function AdminIndexPage() {
  const hasSession = await getAdminSession();
  redirect(hasSession ? "/jmp-admin/dashboard" : "/jmp-admin/login");
}

// TODO(auth): real admin session check (cookie/DB) in the backend phase.
async function getAdminSession(): Promise<boolean> {
  return false;
}
