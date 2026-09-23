import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/sign-in";
import { AuthShell } from "@/components/auth/auth-shell";
import { getSessionUserId } from "@/lib/current-user";

export default async function LoginPage() {
  // Already signed in → straight to the dashboard.
  if (await getSessionUserId()) redirect("/leads");

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your workspace.">
      <LoginForm />
    </AuthShell>
  );
}
