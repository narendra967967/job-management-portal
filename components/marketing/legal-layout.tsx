// Shared wrapper for the public legal pages (Privacy, Terms): marketing header +
// a readable prose column on a glass panel + footer. Content is passed as children.

import { getAppName, getTagline } from "@/lib/branding";
import { isRegistrationOpen } from "@/lib/plans";
import { getSessionUserId } from "@/lib/current-user";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { GlassBackdrop } from "@/components/marketing/glass-backdrop";

const prose =
  "mt-8 text-sm leading-relaxed text-muted-foreground " +
  "[&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground " +
  "[&_h3]:mt-5 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground " +
  "[&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 " +
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_strong]:text-foreground";

export async function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  const [appName, tagline, signupAllowed, sessionId] = await Promise.all([
    getAppName(),
    getTagline(),
    isRegistrationOpen(),
    getSessionUserId(),
  ]);
  return (
    <div className="relative isolate min-h-dvh">
      <GlassBackdrop />
      <SiteHeader appName={appName} signupAllowed={signupAllowed} loggedIn={!!sessionId} />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-16">
        {/* Long-form reading: the more opaque glass keeps body text crisp. */}
        <div className="glass-strong rounded-3xl px-5 py-8 sm:px-10 sm:py-12">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="glass-subtle mt-3 inline-flex rounded-full px-3 py-1 text-xs font-medium text-muted-foreground">
            Last updated {updated}
          </p>
          <article className={prose}>{children}</article>
        </div>
      </main>
      <SiteFooter appName={appName} tagline={tagline.text} />
    </div>
  );
}
