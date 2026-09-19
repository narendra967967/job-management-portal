import { redirect } from "next/navigation";
import { Logo } from "@/components/app-shell/logo";
import { LoginForm } from "@/components/auth/sign-in";
import { getSessionUserId } from "@/lib/current-user";

export default async function LoginPage() {
  // Already signed in → straight to the dashboard.
  if (await getSessionUserId()) redirect("/leads");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Logo showName={false} className="scale-125" />
          <h1 className="mt-5 text-xl font-medium">Job Management Portal</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to your workspace.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border bg-card p-6">
          <LoginForm />
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Accounts are created by an administrator. Connect Google later from
            Settings for Gmail sync.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Personal, single-user system.
        </p>
      </div>
    </main>
  );
}
