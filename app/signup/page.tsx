import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { isRegistrationOpen } from "@/lib/plans";
import { getServerPasswordPolicy } from "@/lib/admin/password-policy-server";
import { getSessionUserId } from "@/lib/current-user";
import { guardMaintenance } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  await guardMaintenance();
  const [allowed, sessionId] = await Promise.all([isRegistrationOpen(), getSessionUserId()]);
  // Already signed in → dashboard. Registration closed (off, or no default plan) → login.
  if (sessionId) redirect("/leads");
  if (!allowed) redirect("/login");

  const policy = await getServerPasswordPolicy();
  return (
    <AuthShell title="Create your account" subtitle="Start organizing your job search.">
      <SignupForm policy={policy} />
    </AuthShell>
  );
}
