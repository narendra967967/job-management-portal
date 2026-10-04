import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/sign-in";
import { AuthShell } from "@/components/auth/auth-shell";
import { auth } from "@/lib/auth";

export default async function LoginPage() {
  // Already signed in as a real user → straight to the dashboard. Admin accounts
  // belong to the admin panel, so they just see the login here (no redirect loop).
  const s = await auth.api.getSession({ headers: await headers() });
  const u = s?.user as { id?: string; role?: string } | undefined;
  if (u?.id && u.role !== "admin") redirect("/leads");

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your workspace.">
      <LoginForm />
    </AuthShell>
  );
}
