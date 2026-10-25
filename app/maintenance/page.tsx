import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Cog } from "lucide-react";
import { db } from "@/lib/db";
import { appSettings } from "@/db/schema";
import { DEFAULT_APP_NAME } from "@/lib/branding";
import { GlassBackdrop } from "@/components/marketing/glass-backdrop";

// Public maintenance screen. Only shown while maintenance mode is on; otherwise
// it bounces back to the app. No auth, no app chrome — a standalone page.

export const metadata: Metadata = { title: "We’ll be right back", robots: { index: false, follow: false } };

// Must render per-request: the redirect + content depend on the live maintenance
// flag, and a static prerender would bake the build-time decision.
export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const [s] = await db.select().from(appSettings).limit(1);
  if (!s?.maintenance) redirect("/");
  const appName = s.appName?.trim() || DEFAULT_APP_NAME;
  const supportEmail = s.supportEmail ?? "";

  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <GlassBackdrop variant="screen" />

      <div className="w-full max-w-lg">
        <div className="glass-strong rounded-3xl p-6 text-center sm:p-10">
          <div className="relative mx-auto mb-6 flex size-20 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/15" />
            <span className="absolute inset-0 rounded-full bg-white/60 ring-1 ring-white" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/api/branding/logo" alt={appName} className="relative size-14 rounded-full object-cover" />
          </div>

          <div className="glass-subtle mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-primary">
            <Cog className="size-3.5 animate-[spin_5s_linear_infinite]" aria-hidden />
            Scheduled maintenance
          </div>

          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">We’ll be right back</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
            {appName} is offline for a short spell of maintenance while we tidy a few things up.
            It’ll be back shortly — thanks for your patience.
          </p>

          {supportEmail && (
            <p className="mt-6 text-sm text-muted-foreground">
              Need something urgent?{" "}
              <a
                href={`mailto:${supportEmail}`}
                className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
              >
                {supportEmail}
              </a>
            </p>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">{appName}</p>
      </div>
    </main>
  );
}
