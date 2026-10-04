import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { getSessionUserId } from "@/lib/current-user";
import { guardMaintenance } from "@/lib/maintenance";

export default async function ForgotPasswordPage() {
  await guardMaintenance();
  if (await getSessionUserId()) redirect("/leads");
  return (
    <AuthShell
      title="Reset password"
      subtitle="Enter your email and we'll send you a reset link."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
