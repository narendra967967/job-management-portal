import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import { Logo } from "@/components/app-shell/logo";
import { GlassBackdrop } from "@/components/marketing/glass-backdrop";
import { getAppName } from "@/lib/branding";

// App-wide 404 — any unknown URL (public site, dashboard or admin). Standalone
// glass page in the website's style; no session lookups.

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

export default async function NotFound() {
  const appName = await getAppName();
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <GlassBackdrop variant="screen" />

      <div className="w-full max-w-md">
        <Link href="/" className="mx-auto mb-6 flex w-fit flex-col items-center gap-2 rounded-2xl">
          <span className="glass-strong flex size-14 items-center justify-center rounded-2xl">
            <Logo showName={false} name={appName} className="scale-110" />
          </span>
          <span className="text-base font-semibold tracking-tight">{appName}</span>
        </Link>

        <div className="glass-strong rounded-3xl p-6 text-center sm:p-10">
          <p className="bg-gradient-to-br from-primary to-[oklch(0.5_0.2_308)] bg-clip-text text-6xl font-semibold tracking-tight text-transparent sm:text-7xl">
            404
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Page not found</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has moved.
          </p>

          <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Back to home
            </Link>
            <Link
              href="/leads"
              className="glass inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium transition-colors hover:bg-white/80"
            >
              <LayoutGrid className="size-4" aria-hidden />
              Go to Leads
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
