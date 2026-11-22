// Public landing page for AI mock interviews (docs/interview-prep/spec.md D3).
// It exists only while admin has AI interviews switched to Open (Module
// settings → Availability); on Coming soon it's a 404 and every link to it is
// hidden. Kinds of interview, lengths and prices come from the module settings,
// so the page always matches what booking charges. Human interviewers (Release
// 2) aren't mentioned until they exist.

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight, BarChart3, Check, Mic, ShieldCheck, Sparkles, Timer } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Faq } from "@/components/marketing/faq";
import { GlassBackdrop } from "@/components/marketing/glass-backdrop";
import { BackToTop } from "@/components/marketing/back-to-top";
import { getAppName, getTagline } from "@/lib/branding";
import { isRegistrationOpen } from "@/lib/plans";
import { getPricingPlans } from "@/lib/pricing";
import { getSessionUserId } from "@/lib/current-user";
import { absoluteUrl, siteUrl } from "@/lib/site-url";
import { getPublicAiInterviews } from "@/lib/mock-interviews/public";
import { DISCUSSION_CATEGORIES, rupees } from "@/lib/mock-interviews/model";
import { categoryIcon } from "@/components/mock-interviews/category-icons";
import { InterviewMock, ReportMock, SampleReport, SetupMock } from "@/components/marketing/ai-interviews-showcase";

// Where "Book an interview" goes; signed-out visitors sign in first and land on it.
const BOOK = "/mock-interviews/ai/new";

export const dynamic = "force-dynamic";

const PATH = "/ai-mock-interviews";
const DESCRIPTION =
  "Practice with an AI interviewer that reads your résumé and the job description, follows up on vague answers and gives you a scored report with better answers.";

export async function generateMetadata(): Promise<Metadata> {
  const [appName, ai] = await Promise.all([getAppName(), getPublicAiInterviews()]);
  if (!ai) return { title: "Page not found", robots: { index: false } };
  const title = `AI Mock Interviews: Practice With Your Résumé | ${appName}`;
  return {
    title: { absolute: title },
    description: DESCRIPTION,
    alternates: { canonical: PATH },
    openGraph: { type: "website", url: PATH, title, description: DESCRIPTION, siteName: appName },
    twitter: { card: "summary_large_image", title, description: DESCRIPTION },
  };
}

// An example exchange for the hero. Made up, and labeled as an example.
const EXCHANGE = [
  { from: "ai", text: "You led the billing migration at your last company. What was the hardest call you made during it?" },
  { from: "you", text: "Pausing the cut-over for a week. Two reconciliation reports didn't match, and I wasn't willing to move customers until they did." },
  { from: "ai", text: "What did that week cost, and how did you explain it to the directors?" },
] as const;

export default async function AiMockInterviewsPage() {
  const [ai, appName, tagline, signupAllowed, sessionId, plans] = await Promise.all([
    getPublicAiInterviews(),
    getAppName(),
    getTagline(),
    isRegistrationOpen(),
    getSessionUserId(),
    getPricingPlans(),
  ]);
  if (!ai) notFound();
  const loggedIn = !!sessionId;
  const free = plans.find((p) => p.isFree && p.aiInterviewsIncluded > 0);
  const paidWithInterviews = plans.filter((p) => !p.isFree && p.aiInterviewsIncluded > 0);
  const lengths = ai.durations.map(String);
  const lengthText = lengths.length > 1 ? `${lengths.slice(0, -1).join(", ")} or ${lengths.at(-1)} minutes` : `${lengths[0]} minutes`;
  const discussion = ai.categories.filter((c) => (DISCUSSION_CATEGORIES as readonly string[]).includes(c));

  const STEPS = [
    {
      Mock: SetupMock,
      title: "Tell it about the interview",
      body: "Pick the role, the kind of interview, the level and the length. Add your résumé and the job description, or choose one of your leads and its description comes with it.",
    },
    {
      Mock: InterviewMock,
      title: "Answer one question at a time",
      body: "Type your answers, or tap the mic and speak, then check the words before you send. A short or vague answer gets a follow-up, the way a real interviewer would push.",
    },
    {
      Mock: ReportMock,
      title: "Read your report a minute later",
      body: "See what went well, the answers to work on with a stronger version of each, and what to practice before the next round.",
    },
  ];

  const FAQ_ITEMS = [
    {
      q: "Am I talking to a real person?",
      a: "No, the interviewer is AI. It asks questions built from your résumé, the job description and the topics you picked, and it doesn't give hints or feedback while you're answering. All of that comes in the report at the end.",
    },
    {
      q: "What if my connection drops halfway through?",
      a: `The clock only runs while you're connected. Come back within ${ai.resumeWindowMinutes} minutes and you pick up at the same question, with the time you had left.`,
    },
    {
      q: "Can I speak my answers instead of typing?",
      a: "Yes, in Chrome, Edge and Safari. Your browser turns what you say into text using its own speech service, you check the text, and then you send it. The interviewer only ever reads text; it never hears your voice.",
    },
    {
      q: "What happens to my résumé and answers?",
      a: `They're sent to the AI service we use so it can write your questions and your report. We don't share them with employers or anyone else, and the interview and report stay in your ${appName} account. The Privacy Policy has the details.`,
    },
    ...(discussion.length
      ? [
          {
            q: `How do ${discussion.join(" and ").toLowerCase()} interviews work without a code editor?`,
            a: "You talk them through, the way many first rounds and phone screens go: explain your approach, the trade-offs and how you'd test it. There's no editor or whiteboard.",
          },
        ]
      : []),
    {
      q: "Can I stop early?",
      a: "Yes. End the interview whenever you like, and the answers you've already given are still scored in your report.",
    },
    {
      q: "Do I need my own AI key?",
      a: `No. ${appName}'s other AI features run on your own key, but mock interviews run on ours. You pay per minute, or use an interview your plan includes.`,
    },
  ];

  const url = siteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: "AI mock interviews",
        description: DESCRIPTION,
        url: absoluteUrl(PATH),
        provider: { "@type": "Organization", name: appName, url },
        offers: ai.levels.map((l) => ({
          "@type": "Offer",
          name: `${l.difficulty} interview, per minute`,
          price: (l.finalPerMinutePaise / 100).toFixed(2),
          priceCurrency: "INR",
          url: absoluteUrl(PATH),
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ_ITEMS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };

  const primary =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:translate-y-px";
  // Signed out, booking goes through the login page and comes back to the form.
  const PrimaryCta = ({ className = primary }: { className?: string }) => (
    <Link href={loggedIn ? BOOK : `/login?next=${encodeURIComponent(BOOK)}`} className={className}>
      Book an interview <ArrowRight className="size-4" aria-hidden />
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
      <SiteHeader appName={appName} signupAllowed={signupAllowed} loggedIn={loggedIn} aiInterviews />

      <main>
        {/* Hero */}
        <section className="relative">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div>
              <span className="glass-subtle inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" aria-hidden /> AI mock interviews
              </span>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">Practice the interview before the one that counts</h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                An AI interviewer reads your résumé and the job description, asks one question at a time and follows up when an answer is
                thin. When you finish, you get a scored report that shows how to answer better.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <PrimaryCta />
                {!loggedIn && signupAllowed && (
                  <Link href="/signup" className="glass inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-3 text-sm font-medium transition-colors hover:bg-white/80">
                    Create an account
                  </Link>
                )}
              </div>
              <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                <Timer className="size-4 shrink-0 text-primary" aria-hidden />
                From {rupees(ai.fromPerMinutePaise)} a minute. Book {lengthText}.
              </p>
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Mic className="size-4 shrink-0 text-primary" aria-hidden />
                Type your answers or speak them.
              </p>
            </div>

            {/* Hero visual: an example exchange and a score */}
            <figure className="relative" aria-label="An example of an AI mock interview">
              <div className="glass rounded-3xl p-3">
                <div className="rounded-2xl bg-white/40 p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2 pb-3">
                    <p className="text-sm font-semibold">Project management · Medium</p>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary tabular-nums">18:42 left</span>
                  </div>
                  <ol className="space-y-2.5">
                    {EXCHANGE.map((m, i) => (
                      <li key={i} className={m.from === "you" ? "flex justify-end" : "flex"}>
                        <p
                          className={
                            m.from === "you"
                              ? "max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-[13px] leading-snug text-primary-foreground"
                              : "glass-strong max-w-[85%] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[13px] leading-snug"
                          }
                        >
                          {m.text}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
              <div className="glass-strong absolute -bottom-6 left-4 flex items-center gap-3 rounded-2xl px-3.5 py-2.5 sm:-left-6">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary tabular-nums">72</span>
                <span className="text-xs leading-tight">
                  <span className="block font-semibold">Report ready</span>
                  <span className="text-muted-foreground">Example score out of 100</span>
                </span>
              </div>
            </figure>
          </div>
        </section>

        {/* How it works: three steps, each with a small picture of the real screen */}
        <section>
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Built around the job you&apos;re going for</h2>
              <p className="mt-4 text-base text-muted-foreground">
                Generic question lists don&apos;t prepare you for questions about your own résumé. These interviews start from it.
              </p>
            </div>
            <ol className="relative mt-12 grid gap-5 lg:grid-cols-3">
              <span aria-hidden className="absolute top-5 right-[16%] left-[16%] hidden h-0.5 bg-gradient-to-r from-primary/40 via-primary/30 to-primary/10 lg:block" />
              {STEPS.map(({ title, body, Mock }, i) => (
                <li key={title} className="relative flex flex-col">
                  <span className="relative z-10 mx-auto flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.5_0.2_308)] text-sm font-semibold text-primary-foreground shadow-sm ring-4 ring-white/70">
                    {i + 1}
                  </span>
                  <div className="glass mt-4 flex flex-1 flex-col rounded-3xl p-4 sm:p-5">
                    <Mock />
                    <h3 className="mt-5 text-base font-semibold">{title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* A sample report, drawn with the app's own report charts */}
        <section>
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:py-24">
            <div>
              <span className="glass-subtle inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-primary">
                <BarChart3 className="size-3.5" aria-hidden /> Your report
              </span>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Know exactly what to fix before the real one</h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Every interview ends with a report on your own answers: a score, how five skills compare with last time, the answers
                that fell short with a stronger version of each, and a short plan for what to practice next.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Ready about a minute after you finish, and we email you",
                  "Better answers written from what you actually said",
                  "Your Performance page charts every interview, so you can see the trend",
                ].map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="size-3.5" aria-hidden />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-xs text-muted-foreground">The report on the right is a made-up sample.</p>
            </div>
            <SampleReport />
          </div>
        </section>

        {/* Kinds of interview */}
        <section>
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Pick the round you&apos;re preparing for</h2>
              <p className="mt-4 text-base text-muted-foreground">
                Easy, Medium or Hard, for {lengthText}. Start easy a few days out, and do a Hard one the night before.
              </p>
            </div>
            <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {ai.categories.map((c) => {
                const Icon = categoryIcon(c);
                const talk = (DISCUSSION_CATEGORIES as readonly string[]).includes(c);
                return (
                  <li key={c} className="glass flex min-h-16 items-center gap-3 rounded-2xl p-3 transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-[oklch(0.62_0.21_330_/_0.14)] text-primary ring-1 ring-white/70">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 text-sm leading-tight font-medium">
                      {c}
                      {talk && <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">Talked through</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-24">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">Pay for the minutes you book</h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-base text-muted-foreground">
              The price depends on the level and the length. A {ai.example.durationMin}-minute {ai.example.difficulty} interview is {rupees(ai.example.pricePaise)}.
            </p>
            <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
              {ai.levels.map((l) => (
                <div key={l.difficulty} className="glass rounded-2xl p-5 text-center">
                  <p className="text-sm font-medium text-muted-foreground">{l.difficulty}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">
                    {rupees(l.finalPerMinutePaise)}
                    <span className="text-base font-normal text-muted-foreground"> / min</span>
                  </p>
                  {l.discountPercent > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <s>{rupees(l.ratePerMinutePaise)}</s> · {l.discountPercent}% off
                    </p>
                  )}
                </div>
              ))}
            </div>
            <ul className="mx-auto mt-8 max-w-2xl space-y-2.5">
              {[
                "The price you see is the full price. Nothing is added at checkout.",
                `A booking can be used for ${ai.bookingValidDays} days. Until you start, you can change everything except the level and length.`,
                ...(free ? [`The ${free.name} plan includes ${free.aiInterviewsIncluded === 1 ? "one interview" : `${free.aiInterviewsIncluded} interviews`} to try it, at no charge.`] : []),
                ...(paidWithInterviews.length
                  ? [`${paidWithInterviews.map((p) => p.name).join(" and ")} ${paidWithInterviews.length === 1 ? "includes" : "include"} interviews with each billing period. See Pricing for how many.`]
                  : []),
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Check className="size-3.5" aria-hidden />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            {paidWithInterviews.length > 0 && (
              <p className="mt-6 text-center text-sm">
                <Link href="/pricing" className="font-medium text-primary underline underline-offset-2">
                  Compare plans
                </Link>
              </p>
            )}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-24">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">Before you book</h2>
            <Faq items={FAQ_ITEMS} />
          </div>
        </section>

        {/* CTA */}
        <section>
          <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:pb-24">
            <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-[oklch(0.46_0.22_294)] to-[oklch(0.5_0.2_308)] px-6 py-12 text-center text-primary-foreground shadow-xl sm:px-12">
              <h2 className="mx-auto max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">Got an interview coming up?</h2>
              <p className="mx-auto mt-3 max-w-md text-sm text-primary-foreground/80">
                Run through it here first, read what to fix, then go again.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <PrimaryCta className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-medium text-primary shadow-sm transition-transform hover:scale-[1.02]" />
              </div>
              <p className="mt-6 flex items-center justify-center gap-2 text-xs text-primary-foreground/80">
                <ShieldCheck className="size-4 shrink-0" aria-hidden />
                We never share your interviews or reports with employers.
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter appName={appName} tagline={tagline.text} aiInterviews />
      <BackToTop />
    </div>
  );
}
