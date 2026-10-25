import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { isRegistrationOpen } from "@/lib/plans";
import { getServerPasswordPolicy } from "@/lib/admin/password-policy-server";
import { getSessionUserId } from "@/lib/current-user";
import { guardMaintenance } from "@/lib/maintenance";
import { captchaSiteKey } from "@/lib/captcha";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create your free account",
  description: "Sign up free and track every job application in one place, with AI to score roles, check your résumé and write better applications.",
  alternates: { canonical: "/signup" },
};

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  await guardMaintenance();
  const [allowed, sessionId] = await Promise.all([isRegistrationOpen(), getSessionUserId()]);
  // Already signed in → dashboard. Registration closed (off, or no default plan) → login.
  if (sessionId) redirect("/leads");
  if (!allowed) redirect("/login");

  const [policy, siteKey] = await Promise.all([getServerPasswordPolicy(), captchaSiteKey()]);
  return (
    <AuthShell title="Create your account" subtitle="Start organizing your job search.">
      <SignupForm policy={policy} captchaSiteKey={siteKey} />
    </AuthShell>
  );
}
