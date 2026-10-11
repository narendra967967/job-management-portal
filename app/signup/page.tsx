import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { getSignupAllowed } from "@/lib/branding";
import { getServerPasswordPolicy } from "@/lib/admin/password-policy-server";
import { getSessionUserId } from "@/lib/current-user";
import { guardMaintenance } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  await guardMaintenance();
  const [allowed, sessionId] = await Promise.all([getSignupAllowed(), getSessionUserId()]);
  // Already signed in → dashboard. Registration closed → send to login.
  if (sessionId) redirect("/leads");
  if (!allowed) redirect("/login");

  const policy = await getServerPasswordPolicy();
  return (
    <AuthShell title="Create your account" subtitle="Start organizing your job search.">
      <SignupForm policy={policy} />
    </AuthShell>
  );
}
