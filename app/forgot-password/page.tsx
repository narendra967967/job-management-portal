import { redirect } from "next/navigation";
import { Logo } from "@/components/app-shell/logo";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getSessionUserId } from "@/lib/current-user";

export default async function ForgotPasswordPage() {
  if (await getSessionUserId()) redirect("/leads");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Logo showName={false} className="scale-110" />
        </div>
        <div className="mt-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Reset password
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>
        <div className="mt-6 rounded-2xl border bg-card p-6 shadow-sm">
          <ForgotPasswordForm />
        </div>
      </div>
    </main>
  );
}
