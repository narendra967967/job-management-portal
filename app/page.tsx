// Public marketing landing page (the app root "/"). Home / Features / About /
// Contact are scroll sections with a smooth-scroll nav; the login page lives at
// /login and self-registration at /signup (shown only when the admin enables it).

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
import { getAppName, getTagline, getSignupAllowed, getSupportEmail } from "@/lib/branding";
import { getSessionUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: Inbox, title: "Inbox lead capture", body: "LinkedIn job alerts in your inbox become tracked leads automatically — no copy-paste." },
  { icon: Gauge, title: "AI summaries & fit scoring", body: "One click summarizes a role and scores how well it fits your résumé, so you focus on the right ones." },
  { icon: LayoutGrid, title: "A clear pipeline", body: "Every lead moves through tidy stages — new, reviewing, applied, outreach — on a board you actually keep up." },
  { icon: Send, title: "Outreach & follow-ups", body: "Draft personalized messages with AI and send them yourself — Jobtiva never sends on your behalf." },
  { icon: Bell, title: "Reminders that stick", body: "Follow-up nudges and to-dos so a promising lead never slips through the cracks." },
  { icon: ShieldCheck, title: "Private by design", body: "Gmail access is strictly read-only, your data stays yours, and nothing leaves without you." },
];

const STEPS = [
  { n: "1", title: "Connect your inbox", body: "Link Gmail (read-only) so your LinkedIn job alerts flow in as leads." },
  { n: "2", title: "Capture & score", body: "AI summarizes each role and scores the fit against your résumé." },
  { n: "3", title: "Reach out & track", body: "Draft outreach, set reminders, and move leads to offer — all in one place." },
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
                <Sparkles className="size-3.5" aria-hidden /> AI-powered job-search command center
              </span>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
                Run your entire job search in one calm place.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                {appName} turns LinkedIn job alerts into tracked leads, scores each role against your
                résumé with AI, and keeps your outreach and follow-ups on schedule.
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
                Read-only Gmail access · your data stays yours.
              </p>
            </div>

            {/* Hero visual — a brand-gradient panel with a faux dashboard */}
            <div className="relative">
              <div className="rounded-3xl bg-gradient-to-br from-primary via-[oklch(0.46_0.22_294)] to-[oklch(0.5_0.2_308)] p-3 shadow-2xl shadow-primary/20 ring-1 ring-white/10">
                <div className="rounded-2xl bg-card p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Your pipeline</p>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">12 active</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[["New", "5"], ["Reviewing", "4"], ["Applied", "3"]].map(([k, v]) => (
                      <div key={k} className="rounded-xl bg-muted/50 p-3">
                        <p className="text-xl font-semibold tabular-nums">{v}</p>
                        <p className="text-[11px] text-muted-foreground">{k}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 space-y-2">
                    {[
                      ["Senior Product Manager", "Acme Corp", "92"],
                      ["Growth Marketer", "Nimbus", "85"],
                      ["UX Designer", "Pixela", "78"],
                    ].map(([role, co, score]) => (
                      <div key={role} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <LayoutGrid className="size-4" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{role}</p>
                          <p className="truncate text-xs text-muted-foreground">{co}</p>
                        </div>
                        <span className="flex items-center gap-1 rounded-full bg-[oklch(0.93_0.045_192)] px-2 py-0.5 text-[11px] font-semibold text-[oklch(0.42_0.11_192)]">
                          <Sparkles className="size-3" aria-hidden /> {score}
                        </span>
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
                From the first job alert to the final follow-up — {appName} keeps the whole process in one organized workspace.
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

        {/* How it works */}
        <section className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n} className="relative rounded-2xl border bg-card p-6">
                  <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.5_0.2_308)] text-sm font-semibold text-primary-foreground">
                    {s.n}
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* About */}
        <section id="about" className="scroll-mt-20 border-t bg-muted/20">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Built for a focused, organized search</h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Job hunting is scattered across tabs, spreadsheets, and inboxes. {appName} pulls it
                into one place — capture opportunities, add AI intelligence, and drive outreach —
                so your search feels like steady, confident progress instead of chaos.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "One workspace from lead to offer",
                  "AI that does the busywork, not the deciding",
                  "Privacy-first: read-only Gmail, your data stays yours",
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
                  ["End to end", "Lead → offer"],
                  ["Read-only", "Gmail access"],
                  ["One click", "AI fit scoring"],
                  ["Zero", "Auto-sent messages"],
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

        {/* CTA + Contact */}
        <section id="contact" className="scroll-mt-20 border-t">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-[oklch(0.46_0.22_294)] to-[oklch(0.5_0.2_308)] px-6 py-12 text-center text-primary-foreground shadow-xl sm:px-12">
              <h2 className="mx-auto max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
                Ready to get your job search organized?
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm text-primary-foreground/80">
                {signupAllowed
                  ? `Create your ${appName} account and bring your whole search into one place.`
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
