// Public marketing landing page (the app root "/"). Home / Features / About /
// Contact are scroll sections with a smooth-scroll nav; the login page lives at
// /login and self-registration at /signup (shown only when the admin enables it).
//
// Positioning: Jobtiva is an *intentional* job-search workspace — manage the roles
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
import { getAppName, getTagline, getSupportEmail } from "@/lib/branding";
import { isRegistrationOpen } from "@/lib/plans";
import { getSessionUserId } from "@/lib/current-user";
import { isGmailOAuthEnabled, supportedSiteExamples } from "@/lib/email-intake-data";

export const dynamic = "force-dynamic";

const STEPS = [
  { n: "1", title: "Set up once", body: "Forward your job alerts to your private address, add your résumé and a short career profile." },
  { n: "2", title: "Leads flow in", body: "Alerts become tracked leads within seconds. Paste or screenshot any other job to add it too." },
  { n: "3", title: "Research & score", body: "AI summarizes each role, scores the fit and checks your résumé — so you focus on the right ones." },
  { n: "4", title: "Apply & follow through", body: "Draft with AI, apply yourself, and let reminders keep every role moving towards an offer." },
];

// Faux kanban board shown in the hero.
const BOARD: { label: string; count: number; cards: { role: string; co: string; score?: string }[] }[] = [
  { label: "New", count: 5, cards: [{ role: "Senior Product Manager", co: "Acme Corp", score: "92" }, { role: "Growth Marketer", co: "Nimbus" }] },
  { label: "Shortlisted", count: 4, cards: [{ role: "UX Designer", co: "Pixela", score: "85" }, { role: "Data Analyst", co: "Corewave" }] },
  { label: "Applied", count: 3, cards: [{ role: "Backend Engineer", co: "Flowbase", score: "88" }] },
];

export default async function LandingPage() {
  const [appName, tagline, signupAllowed, supportEmail, sessionId, gmailOn, sites] = await Promise.all([
    getAppName(),
    getTagline(),
    isRegistrationOpen(),
    getSupportEmail(),
    getSessionUserId(),
    isGmailOAuthEnabled(),
    supportedSiteExamples(),
  ]);
  const loggedIn = !!sessionId;

  const FEATURES = [
    { icon: Inbox, title: "Capture every opportunity", body: `Forward the job alerts you already get from job sites like ${sites}, and many more. They become tracked leads automatically — repeats refresh the lead instead of duplicating it.` },
    { icon: ImagePlus, title: "Add any job in seconds", body: "Paste a job post or drop a screenshot and AI fills in the details, keeping the description word for word. Or add it by hand." },
    { icon: LayoutGrid, title: "A pipeline you keep", body: "Move every lead from new to shortlisted, applied, interview and offer — star your top choices and see it all on a board or a list." },
    { icon: Gauge, title: "Know what fits", body: "AI summarizes each role and scores how well it fits your résumé, with salary insights on supported plans." },
    { icon: FileCheck2, title: "Résumé ATS check", body: "See how each résumé would fare in an applicant tracking system — a score, missing keywords and specific fixes. On supported plans." },
    { icon: UserRound, title: "Your career profile", body: "Tell us your target roles, skills and preferences once. The AI uses them for scoring, résumé checks and drafts." },
    { icon: Send, title: "Apply with better content", body: `Draft tailored applications and outreach with AI, then send them yourself. ${appName} never applies for you.` },
    { icon: Bell, title: "Follow-ups that stick", body: "Reminders, to-dos and the recruiters you're talking to, kept with each role — so nothing falls through the cracks." },
    { icon: ShieldCheck, title: "Private and in your control", body: "We never open your mailbox. See every email that arrived, export or reset your leads, or delete your account — any time." },
  ];

  const FAQ_ITEMS = [
    {
      q: `Will ${appName} apply to jobs for me?`,
      a: `No — and that's on purpose. ${appName} helps you find the right roles, research them, and draft strong applications with AI, but you always review and apply yourself. You stay in control of exactly where you apply.`,
    },
    {
      q: "How do job leads get in?",
      a: `You get a private ${appName} address. Set up a filter in Gmail once, and the job alerts you already receive — from job sites like ${sites}, and many more — are forwarded there and become tracked leads within seconds — no copy-paste. You can also forward an alert by hand, add a job yourself, or paste a job post or a screenshot and let AI fill in the details.`,
    },
    {
      q: "Which job sites are supported?",
      a: `Alerts from many popular job sites — for example ${sites} — become leads automatically, and more sites keep being added. With your own AI key, ${appName} can also read alerts it can't read on its own yet, and any job from anywhere can be added by pasting it or a screenshot.`,
    },
    {
      q: `Does ${appName} read my email?`,
      a: `No. ${appName} never opens your mailbox. It only sees the emails you forward to your private address, accepts them only when they genuinely come from a supported job site (their digital signature is checked), and keeps just the job details — not the email itself. Stop forwarding at any time by removing the Gmail filter.`,
    },
    ...(gmailOn
      ? [
          {
            q: `Why does ${appName} offer to connect my Gmail?`,
            a: `Connecting Gmail is optional — forwarding works without it. If you connect it, ${appName} gets read-only access (Google's gmail.readonly permission) and uses it for one thing: finding your job-alert emails — LinkedIn alerts by default — and turning them into tracked leads. It never sends, changes or deletes email, and doesn't read anything else. You can disconnect any time from Settings. Full details are in our Privacy policy.`,
          },
        ]
      : []),
    {
      q: "Is my data private?",
      a: `Yes. Your data stays yours and nothing leaves without you — it's never sold or used for advertising. Only the job alerts you forward reach ${appName}, and from those we keep the job details, not the emails.`,
    },
    {
      q: "What does the AI actually do?",
      a: `It summarizes each role, scores how well it fits your résumé, drafts tailored applications and outreach, fills in a job from a pasted post or screenshot, and — on supported plans — estimates salaries and checks your résumé. The AI runs on your own API key from OpenAI, Anthropic or OpenRouter, so you pay your provider directly and choose the model. It never sends or applies on your behalf.`,
    },
    {
      q: "What is the résumé ATS check?",
      a: "Many employers screen résumés with an applicant tracking system (ATS) before a person reads them. The check scores each of your résumés out of 100 — standard sections, contact details, measurable impact and length, plus how well its keywords match the roles in your career profile — and lists what to fix. It's available on supported plans.",
    },
    {
      q: `Who is ${appName} for?`,
      a: "Anyone running a focused job search who'd rather apply well to the right handful of roles than blast a thousand — especially busy, mid-career professionals.",
    },
    {
      q: "Can I start over, or delete my account?",
      a: "Yes, both from Settings → Account. Reset leads clears every lead and what's attached to it for a fresh start — you can download a copy first. Or ask us to delete your account and all its data; we email you when it's done, and you can cancel until then. Both are confirmed with a code sent to your email.",
    },
    {
      q: "Is there a free plan?",
      a: "Yes — new accounts start on the Free plan. Paid plans add premium features such as salary insights, the résumé ATS check and personal notes, plus higher limits.",
    },
  ];

  const PrimaryCta = () =>
    loggedIn ? (
      <Link href="/leads" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:translate-y-px">
        Go to dashboard <ArrowRight className="size-4" aria-hidden />
      </Link>
    ) : signupAllowed ? (
      <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:translate-y-px">
        Get started free <ArrowRight className="size-4" aria-hidden />
      </Link>
    ) : (
      <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:translate-y-px">
        Sign in <ArrowRight className="size-4" aria-hidden />
      </Link>
    );

  return (
    <div className="relative isolate min-h-dvh">
      <GlassBackdrop />
      <SiteHeader appName={appName} signupAllowed={signupAllowed} loggedIn={loggedIn} />

      <main>
        {/* Hero */}
        <section id="home" className="relative scroll-mt-24">
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div>
              <span className="glass-subtle inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" aria-hidden /> The intentional job-search workspace
              </span>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
                Run your entire job search in one calm place.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                {appName} brings every role worth your time into one place — research it, apply with
                AI-crafted content, and track each one to offer. Quality over quantity, and you always
                know exactly where you&apos;ve applied.
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
                Private by design · your data stays yours.
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
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Everything your search needs, nothing it doesn&apos;t</h2>
              <p className="mt-4 text-base text-muted-foreground">
                From the first job alert to the final follow-up — {appName} keeps the whole process in one organized workspace, with you in control at every step.
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
            <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-base text-muted-foreground">
              Set it up once, then a simple, intentional loop — research, apply well, and follow through. Not spray-and-pray.
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
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Quality beats quantity</h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Job searching isn&apos;t about blasting a thousand applications and hoping something lands.
                {" "}{appName} is for the roles that are actually right for you — researched, tracked, and
                applied to well.
              </p>
              <div className="glass-subtle mt-5 rounded-2xl border-l-2 border-l-primary p-4 text-sm font-medium">
                Ten thoughtful applications beat a thousand blind ones. Apply to the right 10 and land 6
                calls — not spray 1,000 and hear nothing.
              </div>
              <ul className="mt-6 space-y-3">
                {[
                  "Every role that's right for you, in one place",
                  "AI helps you apply better — you decide where",
                  "Track, get reminded, and always know where you stand",
                  "Private by design — your data stays yours",
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
                  ["Your key", "Your AI provider"],
                  ["Zero", "Auto-applications"],
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
              The short version: you stay in control, and your data stays yours.
            </p>
            <Faq items={FAQ_ITEMS} />
          </div>
        </section>

        {/* CTA + Contact */}
        <section id="contact" className="scroll-mt-24">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-[oklch(0.46_0.22_294)] to-[oklch(0.5_0.2_308)] px-6 py-12 text-center text-primary-foreground shadow-xl sm:px-12">
              <h2 className="mx-auto max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
                Search smarter, not harder.
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm text-primary-foreground/80">
                {signupAllowed
                  ? `Create your ${appName} account and bring your whole search into one intentional place.`
                  : `Sign in to your ${appName} workspace to pick up where you left off.`}
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
                        Get started free <ArrowRight className="size-4" aria-hidden />
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
    </div>
  );
}
