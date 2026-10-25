import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { guardMaintenance } from "@/lib/maintenance";
import { getServerPasswordPolicy } from "@/lib/admin/password-policy-server";
import { captchaSiteKey } from "@/lib/captcha";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Set a new password", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  await guardMaintenance();
  const { token, error } = await searchParams;
  const [policy, siteKey] = await Promise.all([getServerPasswordPolicy(), captchaSiteKey()]);
  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a strong password for your account."
    >
      <ResetPasswordForm token={token ?? ""} tokenError={error} policy={policy} captchaSiteKey={siteKey} />
    </AuthShell>
  );
}
