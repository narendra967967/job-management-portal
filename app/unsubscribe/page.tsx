import type { Metadata } from "next";
import { getAppName } from "@/lib/branding";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { GlassBackdrop } from "@/components/marketing/glass-backdrop";
import { UnsubscribeCard } from "@/components/notifications/unsubscribe-card";

// Public unsubscribe page for promotional emails. No sign-in, no app chrome.
// Opening it changes nothing on the server; the card unsubscribes from the
// browser (see lib/unsubscribe.ts for why).

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const token = typeof t === "string" ? t.trim() : "";
  const appName = await getAppName();
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <GlassBackdrop variant="screen" />
      <div className="w-full max-w-lg">
        <UnsubscribeCard token={token} valid={!!verifyUnsubscribeToken(token)} appName={appName} />
        <p className="mt-6 text-center text-xs text-muted-foreground">{appName}</p>
      </div>
    </main>
  );
}
