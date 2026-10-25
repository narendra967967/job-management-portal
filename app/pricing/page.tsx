// Public pricing page. Plans come from the DB (admin Plans & Pricing → "Show on
// pricing page", active only), so prices, limits and the comparison always match
// what the app enforces. No payments yet: everyone starts on the free trial and
// changes plan from Settings → Plan (an upgrade request).

import { Check } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Faq } from "@/components/marketing/faq";
import { GlassBackdrop } from "@/components/marketing/glass-backdrop";
import { BackToTop } from "@/components/marketing/back-to-top";
import { PricingPlans, type PricingCta } from "@/components/marketing/pricing-plans";
import { getAppName, getTagline } from "@/lib/branding";
import { freeStartLabel, isRegistrationOpen } from "@/lib/plans";
import { getPricingPlans, getUserPlanId } from "@/lib/pricing";
import { getSessionUserId } from "@/lib/current-user";
import { absoluteUrl, siteUrl } from "@/lib/site-url";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const DESCRIPTION =
  "Simple pricing for a focused job search. Start with a free trial, then pick Premium or Pro for unlimited leads, AI drafts, résumé ATS checks and more.";

export async function generateMetadata(): Promise<Metadata> {
  const appName = await getAppName();
  const title = `Pricing: Plans and Free Trial | ${appName}`;
  return {
    title: { absolute: title },
    description: DESCRIPTION,
    alternates: { canonical: "/pricing" },
    openGraph: { type: "website", url: "/pricing", title, description: DESCRIPTION, siteName: appName },
    twitter: { card: "summary_large_image", title, description: DESCRIPTION },
  };
}

// True for every plan (not plan-gated), so listed once instead of in the table.
const EVERY_PLAN = [
  "Job alerts turned into leads by email forwarding",
  "Add jobs by hand, from a post or a screenshot",
  "Board and list views with every hiring stage",
  "Reminders, to-dos and recruiter contacts",
  "AI job summaries and fit scores",
  "Career profile used across the AI tools",
  "Inbound email log, lead export and reset",
];

export default async function PricingPage() {
  const [appName, tagline, signupAllowed, sessionId, freeStart, plans] = await Promise.all([
    getAppName(),
    getTagline(),
    isRegistrationOpen(),
    getSessionUserId(),
    freeStartLabel(),
    getPricingPlans(),
  ]);
  const loggedIn = !!sessionId;
  const currentPlanId = await getUserPlanId(sessionId);
  const trial = freeStart.trialDays > 0;
  const cta: PricingCta = loggedIn ? "manage" : signupAllowed ? "signup" : "login";

  const free = plans.find((p) => p.isFree);
  const freeLeadCap = free?.limitActiveLeads ?? null;

  const FAQ_ITEMS = [
    {
      q: trial ? "Do I need a card for the free trial?" : "Do I need a card to start?",
      a: trial
        ? `No. Every new account starts with a ${freeStart.label} and you don't enter any payment details to begin.`
        : "No. You can start on the free plan without entering any payment details.",
    },
    ...(trial
      ? [
          {
            q: "What happens when my free trial ends?",
            a: `Your leads, contacts and notes stay in your account. To keep using ${appName}, choose a paid plan and you'll pick up exactly where you left off.`,
          },
        ]
      : []),
    {
      q: "How do I upgrade or pay?",
      a: `Open Settings, go to Plan and choose Upgrade. Tell us which plan and billing period you want, and our team will get back to you to complete the payment and switch your plan.`,
    },
    {
      q: "Can I change plans later?",
      a: "Yes. You can move up or down between plans, or switch between monthly and yearly billing, by sending a request from Settings → Plan.",
    },
    {
      q: "Is AI usage included in the price?",
      a: `${appName}'s AI features run on your own API key from OpenAI, Anthropic or OpenRouter. You choose the model and pay your provider directly, which for most job searches comes to very little. Your plan decides which AI features you can use.`,
    },
    ...(freeLeadCap !== null && free
      ? [
          {
            q: `What happens if I reach the ${freeLeadCap}-lead limit on ${free.name}?`,
            a: "Your existing leads stay as they are. New jobs from your alerts aren't added until you archive some leads or upgrade, though alerts for jobs you already have still update them. We let you know when you hit the limit.",
          },
        ]
      : []),
    {
      q: "Which currency are prices in?",
      a: "Prices are shown in Indian rupees (₹).",
    },
  ];

  const url = siteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: appName,
        url,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        offers: plans.flatMap((p) =>
          p.isFree
            ? [{ "@type": "Offer", name: p.name, price: "0", priceCurrency: p.currency, url: absoluteUrl("/pricing") }]
            : [
                ...(p.monthlyPrice > 0
                  ? [{ "@type": "Offer", name: `${p.name} (monthly)`, price: String(p.monthlyPrice), priceCurrency: p.currency, url: absoluteUrl("/pricing") }]
                  : []),
                ...(p.yearlyPrice > 0
                  ? [{ "@type": "Offer", name: `${p.name} (yearly)`, price: String(p.yearlyPrice), priceCurrency: p.currency, url: absoluteUrl("/pricing") }]
                  : []),
              ],
        ),
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ_ITEMS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };

  return (
    <div className="relative isolate min-h-dvh">
      <script
        type="application/ld+json"
        // JSON-LD; "<" escaped so the payload can't close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <GlassBackdrop />
      <SiteHeader appName={appName} signupAllowed={signupAllowed} loggedIn={loggedIn} />

      <main>
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">Simple pricing for a focused job search</h1>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {trial
                ? `Start with a ${freeStart.label}. When you're ready for more, pick the plan that fits how hard you're searching.`
                : "Start free. When you're ready for more, pick the plan that fits how hard you're searching."}
            </p>
          </div>

          {plans.length > 0 ? (
            <PricingPlans plans={plans} cta={cta} trial={trial} currentPlanId={currentPlanId} />
          ) : (
            <p className="glass mx-auto mt-12 max-w-md rounded-2xl p-6 text-center text-sm text-muted-foreground">
              Plans are being updated. Please check back soon.
            </p>
          )}

          {plans.length > 0 && (
            <div className="mx-auto mt-20 max-w-4xl">
              <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">Included in every plan</h2>
              <ul className="glass mt-8 grid gap-x-8 gap-y-3 rounded-2xl p-6 sm:grid-cols-2">
                {EVERY_PLAN.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="size-3.5" aria-hidden />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:pb-24">
          <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">Pricing questions</h2>
          <Faq items={FAQ_ITEMS} />
        </section>
      </main>

      <SiteFooter appName={appName} tagline={tagline.text} />
      <BackToTop />
    </div>
  );
}
