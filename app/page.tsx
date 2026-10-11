// Public marketing landing page (the app root "/"). Home / Features / About /
// Contact are scroll sections with a smooth-scroll nav; the login page lives at
// /login and self-registration at /signup (shown only when the admin enables it).
//
// Positioning: Jobtiva is an *intentional* job-search workspace — manage the roles
// that are right for you and apply well, not a mass-apply automation tool. Copy is
// platform-agnostic (no Gmail/Google specifics — more integrations may come later).

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
} from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Faq } from "@/components/marketing/faq";
import { getAppName, getTagline, getSignupAllowed, getSupportEmail } from "@/lib/branding";
import { getSessionUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: Inbox, title: "Capture every opportunity", body: "Job alerts from your inbox become tracked leads automatically — no copy-paste, nothing slips by." },
  { icon: Gauge, title: "AI fit scoring", body: "One click summarizes a role and scores how well it fits you — so you spend time on the ones worth it." },
  { icon: LayoutGrid, title: "A pipeline you keep", body: "Move every lead through tidy stages — new, reviewing, applied, outreach — on a board you actually maintain." },
  { icon: Send, title: "Apply with better content", body: "Draft tailored applications and outreach with AI, then send them yourself. Jobtiva never applies for you." },
  { icon: Bell, title: "Reminders that stick", body: "Follow-up nudges and to-dos so a role that's right for you never falls through the cracks." },
  { icon: ShieldCheck, title: "Private by design", body: "Any account you connect is read-only, your data stays yours, and nothing leaves without you." },
];

const STEPS = [
  { n: "1", title: "Bring in opportunities", body: "Connect the accounts where your job alerts arrive — they flow in as tracked leads." },
  { n: "2", title: "Research & score", body: "AI summarizes each role and scores the fit, so you focus on the ones that are right for you." },
  { n: "3", title: "Apply & track", body: "Draft a strong application with AI, apply yourself, set reminders, and follow each one to offer." },
];

// Faux kanban board shown in the hero.
const BOARD: { label: string; count: number; cards: { role: string; co: string; score?: string }[] }[] = [
  { label: "New", count: 5, cards: [{ role: "Senior Product Manager", co: "Acme Corp", score: "92" }, { role: "Growth Marketer", co: "Nimbus" }] },
  { label: "Reviewing", count: 4, cards: [{ role: "UX Designer", co: "Pixela", score: "85" }, { role: "Data Analyst", co: "Corewave" }] },
  { label: "Applied", count: 3, cards: [{ role: "Backend Engineer", co: "Flowbase", score: "88" }] },
];

export default async function LandingPage() {
  const [appName, tagline, signupAllowed, supportEmail, sessionId] = await Promise.all([
    getAppName(),
    getTagline(),
    getSignupAllowed(),
    getSupportEmail(),
    getSessionUserId(),
  ]);
  const loggedIn = !!sessionId;

  const FAQ_ITEMS = [
    {
      q: `Will ${appName} apply to jobs for me?`,
      a: `No — and that's on purpose. ${appName} helps you find the right roles, research them, and draft strong applications with AI, but you always review and apply yourself. You stay in control of exactly where you apply.`,
    },
    {
      q: "How do job leads get in?",
      a: "Connect the account where your job alerts arrive and they flow in as tracked leads automatically — no copy-paste. More sources are on the roadmap.",
    },
    {
      q: "Is my data private?",
      a: "Yes. Any account you connect is strictly read-only, your data stays yours, and nothing leaves without you. You can disconnect any time from Settings.",
    },
    {
      q: "What does the AI actually do?",
      a: "It summarizes each role, scores how well it fits you, and drafts tailored applications and outreach — so you spend time on the right roles and apply better. It never sends or applies on your behalf.",
    },
    {
      q: `Who is ${appName} for?`,
      a: "Anyone running a focused job search who'd rather apply well to the right handful of roles than blast a thousand — especially busy, mid-career professionals.",
    },
    {
      q: "Is there a free plan?",
      a: "Yes — new accounts start on the Free plan. Paid plans add higher limits and extra automation as your search scales.",
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
    <div className="min-h-dvh bg-background">
      <SiteHeader appName={appName} signupAllowed={signupAllowed} loggedIn={loggedIn} />

      <main>
        {/* Hero */}
        <section id="home" className="relative scroll-mt-20 overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute -top-40 -right-32 size-[36rem] rounded-full bg-primary/10 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-48 -left-40 size-[36rem] rounded-full bg-[oklch(0.62_0.21_330_/_0.1)] blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
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
                  <Link href="/login" className="inline-flex items-center justify-center rounded-xl border px-5 py-3 text-sm font-medium transition-colors hover:bg-muted">
                    Log in
                  </Link>
                )}
              </div>
              <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
                Private by design · your data stays yours.
              </p>
            </div>

            {/* Hero visual — a brand-gradient frame around a faux kanban board */}
            <div className="relative">
              <div className="rounded-3xl bg-gradient-to-br from-primary via-[oklch(0.46_0.22_294)] to-[oklch(0.5_0.2_308)] p-3 shadow-2xl shadow-primary/20 ring-1 ring-white/10">
                <div className="rounded-2xl bg-card p-3">
                  <div className="flex items-center justify-between px-1 pb-2.5">
                    <p className="text-sm font-semibold">Your pipeline</p>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">12 active</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {BOARD.map((col) => (
                      <div key={col.label} className="rounded-xl bg-muted/40 p-1.5">
                        <div className="flex items-center justify-between px-1 pb-1.5">
                          <span className="text-[11px] font-medium text-muted-foreground">{col.label}</span>
                          <span className="text-[11px] tabular-nums text-muted-foreground">{col.count}</span>
                        </div>
                        <div className="space-y-1.5">
                          {col.cards.map((c) => (
                            <div key={c.role} className="rounded-lg border bg-card p-2">
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
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 border-t bg-muted/20">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Everything your search needs, nothing it doesn&apos;t</h2>
              <p className="mt-4 text-base text-muted-foreground">
                From the first job alert to the final follow-up — {appName} keeps the whole process in one organized workspace, with you in control at every step.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-2xl border bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5.5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works — timeline */}
        <section className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-base text-muted-foreground">
              A simple, intentional loop — research, apply well, and follow through. Not spray-and-pray.
            </p>

            {/* Desktop: horizontal timeline */}
            <div className="relative mt-14 hidden md:block">
              <div aria-hidden className="absolute top-5 left-[16.6%] right-[16.6%] h-0.5 bg-gradient-to-r from-primary/40 via-primary/30 to-primary/10" />
              <ol className="grid grid-cols-3 gap-8">
                {STEPS.map((s) => (
                  <li key={s.n} className="flex flex-col items-center text-center">
                    <span className="relative z-10 flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.5_0.2_308)] text-sm font-semibold text-primary-foreground shadow-sm ring-4 ring-background">
                      {s.n}
                    </span>
                    <h3 className="mt-5 text-base font-semibold">{s.title}</h3>
                    <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                  </li>
                ))}
              </ol>
            </div>

            {/* Mobile: vertical timeline */}
            <ol className="mt-12 md:hidden">
              {STEPS.map((s, i) => (
                <li key={s.n} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.5_0.2_308)] text-sm font-semibold text-primary-foreground shadow-sm">
                      {s.n}
                    </span>
                    {i < STEPS.length - 1 && <span aria-hidden className="my-1 w-0.5 flex-1 bg-border" />}
                  </div>
                  <div className="pb-8">
                    <h3 className="text-base font-semibold">{s.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* About — the philosophy */}
        <section id="about" className="scroll-mt-20 border-t bg-muted/20">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Quality beats quantity</h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Job searching isn&apos;t about blasting a thousand applications and hoping something lands.
                {" "}{appName} is for the roles that are actually right for you — researched, tracked, and
                applied to well.
              </p>
              <div className="mt-5 rounded-2xl border-l-2 border-primary bg-card p-4 text-sm font-medium">
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
            <div className="rounded-3xl border bg-card p-8 shadow-sm">
              <div className="grid grid-cols-2 gap-6">
                {[
                  ["10 › 1000", "Quality over quantity"],
                  ["You decide", "Where to apply"],
                  ["One click", "AI fit scoring"],
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
        <section id="faq" className="scroll-mt-20 border-t">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">Frequently asked questions</h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-base text-muted-foreground">
              The short version: you stay in control, and your data stays yours.
            </p>
            <Faq items={FAQ_ITEMS} />
          </div>
        </section>

        {/* CTA + Contact */}
        <section id="contact" className="scroll-mt-20 border-t">
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
                <a href={`mailto:${supportEmail}`} className="mt-1 inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted">
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
