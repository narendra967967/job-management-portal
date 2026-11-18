import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/sign-in";
import { AuthShell } from "@/components/auth/auth-shell";
import { auth } from "@/lib/auth";
import { guardMaintenance } from "@/lib/maintenance";
import { isRegistrationOpen } from "@/lib/plans";
import { captchaSiteKey } from "@/lib/captcha";
import type { Metadata } from "next";
import { safeNextPath } from "@/lib/safe-next";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your job search workspace.",
  alternates: { canonical: "/login" },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await guardMaintenance();
  // ?next= brings someone back to what they opened while signed out (e.g. an invoice).
  const next = safeNextPath((await searchParams).next);
  // Already signed in as a real user → straight to the dashboard. Admin accounts
  // belong to the admin panel, so they just see the login here (no redirect loop).
  const [s, signupAllowed, siteKey] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    isRegistrationOpen(),
    captchaSiteKey(),
  ]);
  const u = s?.user as { id?: string; role?: string } | undefined;
  if (u?.id && u.role !== "admin") redirect(next ?? "/leads");

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your workspace.">
      <LoginForm signupAllowed={signupAllowed} captchaSiteKey={siteKey} next={next} />
    </AuthShell>
  );
}
