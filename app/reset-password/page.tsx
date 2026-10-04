import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { guardMaintenance } from "@/lib/maintenance";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  await guardMaintenance();
  const { token, error } = await searchParams;
  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a strong password for your account."
    >
      <ResetPasswordForm token={token ?? ""} tokenError={error} />
    </AuthShell>
  );
}
