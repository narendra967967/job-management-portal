import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAppName } from "@/lib/branding";
import { GlassBackdrop } from "@/components/marketing/glass-backdrop";
import { UnsubscribeCard } from "@/components/notifications/unsubscribe-card";

// Public unsubscribe page for promotional emails. No sign-in, no app chrome.
// PHASE 1: sample only, so production builds don't serve it until phase 4
// wires the signed link.

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { t } = await searchParams;
  const appName = await getAppName();
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <GlassBackdrop variant="screen" />
      <div className="w-full max-w-lg">
        <UnsubscribeCard token={t?.trim() || null} appName={appName} />
        <p className="mt-6 text-center text-xs text-muted-foreground">{appName}</p>
      </div>
    </main>
  );
}
