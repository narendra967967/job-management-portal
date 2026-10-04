import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Cog } from "lucide-react";
import { db } from "@/lib/db";
import { appSettings } from "@/db/schema";
import { DEFAULT_APP_NAME } from "@/lib/branding";

// Public maintenance screen. Only shown while maintenance mode is on; otherwise
// it bounces back to the app. No auth, no app chrome — a standalone page.

export const metadata: Metadata = { title: "We’ll be right back" };

export default async function MaintenancePage() {
  const [s] = await db.select().from(appSettings).limit(1);
  if (!s?.maintenance) redirect("/");
  const appName = s.appName?.trim() || DEFAULT_APP_NAME;
  const supportEmail = s.supportEmail ?? "";

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 py-10">
      {/* soft colour wash for depth */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 size-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute -right-16 -bottom-32 size-96 rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 size-72 -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl sm:p-10">
          <div className="relative mx-auto mb-6 flex size-20 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-indigo-500/20" />
            <span className="absolute inset-0 rounded-full border border-white/10" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/api/branding/logo" alt={appName} className="relative size-14 rounded-full object-cover" />
          </div>

          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-indigo-200">
            <Cog className="size-3.5 animate-[spin_5s_linear_infinite]" aria-hidden />
            Scheduled maintenance
          </div>

          <h1 className="text-2xl font-semibold text-white sm:text-3xl">We’ll be right back</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-300 sm:text-base">
            {appName} is offline for a short spell of maintenance while we tidy a few things up.
            It’ll be back shortly — thanks for your patience.
          </p>

          {supportEmail && (
            <p className="mt-6 text-sm text-slate-400">
              Need something urgent?{" "}
              <a
                href={`mailto:${supportEmail}`}
                className="font-medium text-indigo-300 underline-offset-4 hover:underline"
              >
                {supportEmail}
              </a>
            </p>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">{appName}</p>
      </div>
    </main>
  );
}
