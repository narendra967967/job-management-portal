import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/app-shell/logo";
import { GoogleSignInButton } from "@/components/auth/sign-in";
import { authEnabled, getSessionUserId } from "@/lib/current-user";
import { Button } from "@/components/ui/button";

export default async function LoginPage() {
  const enabled = authEnabled();
  if (enabled) {
    const id = await getSessionUserId();
    if (id) redirect("/leads");
  }

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
          {enabled ? (
            <>
              <GoogleSignInButton />
              <p className="mt-4 text-center text-xs text-muted-foreground">
                One consent screen grants sign-in and read-only Gmail access.
              </p>
            </>
          ) : (
            <>
              <Button
                nativeButton={false}
                render={<Link href="/leads" />}
                className="w-full"
              >
                Enter workspace
              </Button>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Dev mode — Google sign-in activates once{" "}
                <code className="text-[11px]">GOOGLE_CLIENT_ID</code> /{" "}
                <code className="text-[11px]">SECRET</code> are set in{" "}
                <code className="text-[11px]">.env.local</code>.
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Personal, single-user system.
        </p>
      </div>
    </main>
  );
}
