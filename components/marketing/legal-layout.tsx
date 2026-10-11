// Shared wrapper for the public legal pages (Privacy, Terms): marketing header +
// a readable prose column + footer. Content is passed as children.

import { getAppName, getTagline, getSignupAllowed } from "@/lib/branding";
import { getSessionUserId } from "@/lib/current-user";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

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
    getSignupAllowed(),
    getSessionUserId(),
  ]);
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader appName={appName} signupAllowed={signupAllowed} loggedIn={!!sessionId} />
      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>
        <article className={prose}>{children}</article>
      </main>
      <SiteFooter appName={appName} tagline={tagline.text} />
    </div>
  );
}
