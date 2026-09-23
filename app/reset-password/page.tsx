import { Logo } from "@/components/app-shell/logo";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Logo showName={false} className="scale-110" />
        </div>
        <div className="mt-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Set a new password
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a strong password for your account.
          </p>
        </div>
        <div className="mt-6 rounded-2xl border bg-card p-6 shadow-sm">
          <ResetPasswordForm token={token ?? ""} tokenError={error} />
        </div>
      </div>
    </main>
  );
}
