// Public marketing landing page (the app root "/"). Home / Features / About /
// Contact are scroll sections with a smooth-scroll nav; the login page lives at
// /login and self-registration at /signup (shown only when the admin enables it).
//
// Positioning: Jobtiva is a job search tracker for focused job seekers — manage the roles
// that are right for you and apply well, not a mass-apply automation tool. Leads
// come in by email forwarding; the FAQ says plainly that Jobtiva only sees what
// users forward. While "Connect Gmail" is switched on (admin), the FAQ also
// explains its Gmail access — Google's OAuth verification requires that.
// AI features run on the user's OWN key (OpenAI / Anthropic / OpenRouter) — the
// copy must never imply built-in AI. Premium features say "on supported plans".

import Link from "next/link";
import {
  ArrowRight,
  Inbox,
  Gauge,
  LayoutGrid,
  Send,
  Bell,
  ShieldCheck,
  Sparkles,
  Mail,
  Check,
  ImagePlus,
  FileCheck2,
  UserRound,
} from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Faq } from "@/components/marketing/faq";
import { GlassBackdrop } from "@/components/marketing/glass-backdrop";
import { BackToTop } from "@/components/marketing/back-to-top";
import { getAppName, getTagline, getSupportEmail } from "@/lib/branding";
import { freeStartLabel, isRegistrationOpen } from "@/lib/plans";
import { getSessionUserId } from "@/lib/current-user";
import { isGmailOAuthEnabled, supportedSiteExamples } from "@/lib/email-intake-data";
import { absoluteUrl, siteUrl } from "@/lib/site-url";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

// Search snippet (≈155 chars) — also the structured-data description.
const DESCRIPTION =
  "Track job applications in one place. Turn job alerts into leads, score each role against your résumé, check it for ATS and write better applications with AI.";

export async function generateMetadata(): Promise<Metadata> {
  const appName = await getAppName();
  const title = `${appName}: Job Application Tracker with AI`;
  return {
    title: { absolute: title },
    description: DESCRIPTION,
    alternates: { canonical: "/" },
    openGraph: { type: "website", url: "/", title, description: DESCRIPTION, siteName: appName },
    twitter: { card: "summary_large_image", title, description: DESCRIPTION },
  };
}

const STEPS = [
  { n: "1", title: "Set up in a few minutes", body: "Create one Gmail filter that forwards your job alerts to your private address. Then add your résumé and a short career profile." },
  { n: "2", title: "New jobs arrive on their own", body: "Each alert turns into a lead within seconds. Found a job somewhere else? Paste the post or add a screenshot." },
  { n: "3", title: "Review and shortlist", body: "Read the AI summary, check the fit score and tighten your résumé before you apply." },
  { n: "4", title: "Apply and follow up", body: "Write your message, apply on the company's site and let reminders tell you when to follow up." },
];

// Faux kanban board shown in the hero.
const BOARD: { label: string; count: number; cards: { role: string; co: string; score?: string }[] }[] = [
  { label: "New", count: 5, cards: [{ role: "Senior Product Manager", co: "Acme Corp", score: "92" }, { role: "Growth Marketer", co: "Nimbus" }] },
  { label: "Shortlisted", count: 4, cards: [{ role: "UX Designer", co: "Pixela", score: "85" }, { role: "Data Analyst", co: "Corewave" }] },
  { label: "Applied", count: 3, cards: [{ role: "Backend Engineer", co: "Flowbase", score: "88" }] },
];

export default async function LandingPage() {
  const [appName, tagline, signupAllowed, supportEmail, sessionId, gmailOn, sites, freeStart] = await Promise.all([
    getAppName(),
    getTagline(),
    isRegistrationOpen(),
    getSupportEmail(),
    getSessionUserId(),
    isGmailOAuthEnabled(),
    supportedSiteExamples(),
    freeStartLabel(),
  ]);
  const trial = freeStart.trialDays > 0;
  const loggedIn = !!sessionId;

  const FEATURES = [
    { icon: Inbox, title: "Turn job alerts into leads", body: `Forward the job alerts you already get from sites like ${sites}, and many more. Each job lands in your list as a lead, and if the same job turns up again, ${appName} refreshes it instead of adding a copy.` },
    { icon: ImagePlus, title: "Add a job from a post or screenshot", body: "Paste a job post or drop in a screenshot. AI fills in the title, company and location, and keeps the job description exactly as written. You can add jobs by hand too." },
    { icon: LayoutGrid, title: "A job tracker you'll actually keep up", body: "Move each job from New to Shortlisted, Applied, Interview and Offer. Star your top choices and switch between a board and a list whenever you like." },
    { icon: Gauge, title: "See which jobs fit you", body: "AI reads each job description and scores how well it matches your résumé. On supported plans, you also get a salary estimate for the role." },
    { icon: FileCheck2, title: "Résumé ATS checker", body: "Find out how your résumé is likely to do in an applicant tracking system. You get a score out of 100, the keywords you're missing and a short list of fixes. Available on supported plans." },
    { icon: UserRound, title: "One career profile, used everywhere", body: `Add your target roles, skills and job preferences once. ${appName} uses them when it scores jobs, checks your résumé and drafts messages.` },
    { icon: Send, title: "Write better applications", body: `Draft tailored messages to recruiters and referrals with AI, then edit and send them yourself. ${appName} never applies or sends anything for you.` },
    { icon: Bell, title: "Never miss a follow-up", body: "Set reminders, keep a to-do list and save the recruiters you're talking to with each job, so no application goes quiet by accident." },
    { icon: ShieldCheck, title: "Your data, your call", body: "We never open your mailbox. You can see every email that reached your address, export your leads, start over or delete your account whenever you want." },
  ];

  // Plain-text Q&A: rendered in the FAQ and published as FAQPage structured data.
  const FAQ_ITEMS = [
    {
      q: `What is ${appName}?`,
      a: `${appName} is a job search tracker. It collects the job alerts you forward from your email, organizes them as leads and gives you AI tools to score each role, check your résumé and write better applications. You stay in control and apply to every job yourself.`,
    },
    {
      q: `Does ${appName} apply to jobs for me?`,
      a: `No. ${appName} is not an auto-apply tool. It helps you pick the right roles and prepare strong applications, but you review everything and apply yourself.`,
    },
    {
      q: `How do jobs get into ${appName}?`,
      a: `Most people set up one Gmail filter. It forwards job alerts from sites like ${sites}, and many more, to a private ${appName} address, and each job appears as a lead within seconds. You can also forward an alert by hand, add a job yourself or paste a job post or screenshot.`,
    },
    {
      q: `Which job sites does ${appName} work with?`,
      a: `It reads job alerts from many popular job sites, for example ${sites}, and more are added over time. If a site isn't supported yet, your own AI key can read its alerts, and you can always add a job by pasting it.`,
    },
    {
      q: `Does ${appName} read my email?`,
      a: `No. ${appName} never connects to your mailbox. It only sees the emails you forward to your private address, checks that they really come from a job site and keeps the job details, not the email. To stop, just remove the Gmail filter.`,
    },
    ...(gmailOn
      ? [
          {
            q: `Why does ${appName} offer to connect my Gmail?`,
            a: `Connecting Gmail is optional; forwarding works without it. If you connect it, ${appName} gets read-only access (Google's gmail.readonly permission) and uses it for one thing: finding your job-alert emails, LinkedIn alerts by default, and turning them into leads. It never sends, changes or deletes email and doesn't read anything else. You can disconnect it any time in Settings. Our Privacy Policy has the full details.`,
          },
        ]
      : []),
    {
      q: "Is my data private?",
      a: `Yes. We don't sell your data or use it for advertising, and only the job alerts you forward ever reach ${appName}. You can export your leads, start over or delete your account at any time.`,
    },
    {
      q: `How does ${appName} use AI?`,
      a: "AI summarizes job descriptions, scores how well each role fits your résumé, drafts applications and outreach, and fills in job details from a pasted post or screenshot. On supported plans it also estimates salaries and checks your résumé for ATS. It runs on your own API key from OpenAI, Anthropic or OpenRouter, so you choose the model and pay your provider directly.",
    },
    {
      q: "What is an ATS résumé check?",
      a: `Many employers use an applicant tracking system (ATS) to filter résumés before a recruiter sees them. ${appName}'s check scores each résumé out of 100, looking at standard sections, contact details, measurable results, length and how well its keywords match your target roles. Then it tells you what to fix. It's included in supported plans.`,
    },
    {
      q: `Who is ${appName} for?`,
      a: "Job seekers who would rather apply carefully to fewer, better-matched roles. It suits busy, mid-career professionals especially well, but anyone running a serious job search can use it.",
    },
    {
      q: "Can I start over or delete my account?",
      a: "Yes. In Settings → Account, Reset leads clears all your leads so you can start a fresh search, and you can download a copy first. You can also ask us to delete your account and all its data. Both actions are confirmed with a code sent to your email.",
    },
    {
      q: trial ? `Is there a free trial?` : `Is ${appName} free?`,
      a: trial
        ? `Yes. Every new account starts with a ${freeStart.label}, no payment needed. After that, Premium gives you unlimited leads, AI outreach drafts and AI reading of alerts from more job sites, and Pro adds everything else, including the résumé ATS check, salary insight and custom AI prompts.`
        : "Yes, you can start on the free plan. Paid plans add premium features such as salary estimates, the résumé ATS check and personal notes, along with higher limits.",
    },
  ];

  // Structured data for search engines and AI assistants (schema.org).
  const url = siteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${url}/#organization`,
        name: appName,
        url,
        logo: absoluteUrl("/api/branding/logo"),
        ...(supportEmail ? { email: supportEmail } : {}),
      },
      {
        "@type": "WebSite",
        "@id": `${url}/#website`,
        name: appName,
        url,
        publisher: { "@id": `${url}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        name: appName,
        url,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: DESCRIPTION,
        featureList: FEATURES.map((f) => f.title),
        offers: { "@type": "Offer", price: "0", priceCurrency: "INR", description: trial ? `${freeStart.trialDays}-day free trial` : "Free plan" },
        publisher: { "@id": `${url}/#organization` },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ_ITEMS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  const PrimaryCta = () =>
    loggedIn ? (
      <Link href="/leads" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:translate-y-px">
        Go to dashboard <ArrowRight className="size-4" aria-hidden />
      </Link>
    ) : signupAllowed ? (
      <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:translate-y-px">
        {trial ? "Start free trial" : "Get started free"} <ArrowRight className="size-4" aria-hidden />
      </Link>
    ) : (
      <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:translate-y-px">
        Sign in <ArrowRight className="size-4" aria-hidden />
      </Link>
    );

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
        {/* Hero */}
        <section id="home" className="relative scroll-mt-24">
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div>
              <span className="glass-subtle inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" aria-hidden /> Job search tracker with AI
              </span>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
                Track every job application in one organized place
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                {appName} turns the job alerts in your inbox into a tidy list of leads. Score each role
                against your résumé, write better applications with AI and follow up on time. You apply
                yourself, and only to the jobs that actually fit.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <PrimaryCta />
                {!loggedIn && (
                  <Link href="/login" className="glass inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium transition-colors hover:bg-white/80">
                    Log in
                  </Link>
                )}
              </div>
              <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                <Inbox className="size-4 shrink-0 text-primary" aria-hidden />
                Works with job alerts from sites like {sites}, and many more.
              </p>
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
                Private by design. Your data stays yours.
              </p>
            </div>

            {/* Hero visual — a glass panel holding a faux kanban board */}
            <div className="relative">
              <div className="glass rounded-3xl p-3">
                <div className="rounded-2xl bg-white/40 p-3">
                  <div className="flex items-center justify-between px-1 pb-2.5">
                    <p className="text-sm font-semibold">Your pipeline</p>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">12 active</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {BOARD.map((col) => (
                      <div key={col.label} className="rounded-xl bg-white/45 p-1.5">
                        <div className="flex items-center justify-between px-1 pb-1.5">
                          <span className="text-[11px] font-medium text-muted-foreground">{col.label}</span>
                          <span className="text-[11px] tabular-nums text-muted-foreground">{col.count}</span>
                        </div>
                        <div className="space-y-1.5">
                          {col.cards.map((c) => (
                            <div key={c.role} className="glass-strong rounded-lg p-2">
                              <p className="truncate text-[11px] font-medium leading-tight">{c.role}</p>
                              <p className="truncate text-[10px] text-muted-foreground">{c.co}</p>
                              {c.score && (
                                <span className="mt-1.5 inline-flex items-center gap-0.5 rounded-full bg-[oklch(0.93_0.045_192)] px-1.5 py-0.5 text-[9px] font-semibold text-[oklch(0.42_0.11_192)]">
                                  <Sparkles className="size-2.5" aria-hidden /> {c.score}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="glass-strong absolute -bottom-6 left-4 flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 sm:-left-6">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Inbox className="size-4" aria-hidden />
                </span>
                <span className="text-xs leading-tight">
                  <span className="block font-semibold">6 new leads</span>
                  <span className="text-muted-foreground">from today&apos;s job alerts</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-24">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Everything you need to run a focused job search</h2>
              <p className="mt-4 text-base text-muted-foreground">
                From the first job alert to the last follow-up, {appName} keeps your whole search in one workspace, and you stay in charge of every step.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="glass rounded-2xl p-5 transition-transform duration-200 hover:-translate-y-0.5">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-[oklch(0.62_0.21_330_/_0.14)] text-primary ring-1 ring-white/70">
                    <Icon className="size-5.5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works — timeline on a glass panel */}
        <section>
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">How {appName} works</h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-base text-muted-foreground">
              Set it up once. After that it&apos;s a simple routine: review new jobs, apply to the right ones and follow up.
            </p>

            <div className="glass mt-12 rounded-3xl px-5 py-10 sm:px-8">
            {/* Large screens: horizontal timeline (4 steps need the width) */}
            <div className="relative hidden lg:block">
              <div aria-hidden className="absolute top-5 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-primary/40 via-primary/30 to-primary/10" />
              <ol className="grid grid-cols-4 gap-6">
                {STEPS.map((s) => (
                  <li key={s.n} className="flex flex-col items-center text-center">
                    <span className="relative z-10 flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.5_0.2_308)] text-sm font-semibold text-primary-foreground shadow-sm ring-4 ring-white/70">
                      {s.n}
                    </span>
                    <h3 className="mt-5 text-base font-semibold">{s.title}</h3>
                    <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                  </li>
                ))}
              </ol>
            </div>

            {/* Phones and tablets: vertical timeline */}
            <ol className="lg:hidden">
              {STEPS.map((s, i) => (
                <li key={s.n} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.5_0.2_308)] text-sm font-semibold text-primary-foreground shadow-sm">
                      {s.n}
                    </span>
                    {i < STEPS.length - 1 && <span aria-hidden className="my-1 w-0.5 flex-1 bg-primary/20" />}
                  </div>
                  <div className={i < STEPS.length - 1 ? "pb-8" : ""}>
                    <h3 className="text-base font-semibold">{s.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            </div>
          </div>
        </section>

        {/* About — the philosophy */}
        <section id="about" className="scroll-mt-24">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Why quality beats quantity in a job search</h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Sending hundreds of applications rarely works. Recruiters spot generic applications quickly,
                and you soon lose track of where you applied. {appName} is built for the opposite approach: a
                short list of roles that suit you, each one researched and applied to properly.
              </p>
              <div className="glass-subtle mt-5 rounded-2xl border-l-2 border-l-primary p-4 text-sm font-medium">
                Ten well-chosen applications usually get more replies than a thousand rushed ones.
              </div>
              <ul className="mt-6 space-y-3">
                {[
                  "All the jobs worth your time in one list",
                  "AI helps you write better; you decide where to apply",
                  "Reminders keep every application moving",
                  "Private by design, and nothing is ever sent for you",
                ].map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="size-3.5" aria-hidden />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="glass rounded-3xl p-8">
              <div className="grid grid-cols-2 gap-6">
                {[
                  ["10 › 1000", "Quality over quantity"],
                  ["You decide", "Where to apply"],
                  ["Your key", "Your choice of AI provider"],
                  ["Zero", "Applications sent for you"],
                ].map(([big, small]) => (
                  <div key={small}>
                    <p className="text-2xl font-semibold tracking-tight text-primary">{big}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{small}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-24">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">Frequently asked questions</h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-base text-muted-foreground">
              Quick answers about how {appName} works, what happens to your data and how the AI fits in.
            </p>
            <Faq items={FAQ_ITEMS} />
          </div>
        </section>

        {/* CTA + Contact */}
        <section id="contact" className="scroll-mt-24">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-[oklch(0.46_0.22_294)] to-[oklch(0.5_0.2_308)] px-6 py-12 text-center text-primary-foreground shadow-xl sm:px-12">
              <h2 className="mx-auto max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
                Start your focused job search today
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm text-primary-foreground/80">
                {signupAllowed
                  ? `Start your ${freeStart.label} and bring your job search into one organized place.`
                  : `Sign in to ${appName} to pick up where you left off.`}
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                {loggedIn ? (
                  <Link href="/leads" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-medium text-primary shadow-sm transition-transform hover:scale-[1.02]">
                    Go to dashboard <ArrowRight className="size-4" aria-hidden />
                  </Link>
                ) : (
                  <>
                    {signupAllowed && (
                      <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-medium text-primary shadow-sm transition-transform hover:scale-[1.02]">
                        {trial ? "Start free trial" : "Get started free"} <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    )}
                    <Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-sm font-medium text-primary-foreground ring-1 ring-inset ring-white/25 transition-colors hover:bg-white/15">
                      Log in
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="mt-10 flex flex-col items-center gap-2 text-center">
              <h3 className="text-lg font-semibold">Questions?</h3>
              <p className="text-sm text-muted-foreground">We&apos;re happy to help.</p>
              {supportEmail ? (
                <a href={`mailto:${supportEmail}`} className="glass mt-1 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/80">
                  <Mail className="size-4 text-primary" aria-hidden /> {supportEmail}
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">Reach us any time through the app&apos;s Help &amp; support.</p>
              )}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter appName={appName} tagline={tagline.text} />
      <BackToTop />
    </div>
  );
}
