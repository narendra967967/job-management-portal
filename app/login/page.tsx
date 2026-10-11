import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/sign-in";
import { AuthShell } from "@/components/auth/auth-shell";
import { auth } from "@/lib/auth";
import { guardMaintenance } from "@/lib/maintenance";
import { getSignupAllowed } from "@/lib/branding";

export default async function LoginPage() {
  await guardMaintenance();
  // Already signed in as a real user → straight to the dashboard. Admin accounts
  // belong to the admin panel, so they just see the login here (no redirect loop).
  const [s, signupAllowed] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    getSignupAllowed(),
  ]);
  const u = s?.user as { id?: string; role?: string } | undefined;
  if (u?.id && u.role !== "admin") redirect("/leads");

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your workspace.">
      <LoginForm signupAllowed={signupAllowed} />
    </AuthShell>
  );
}
