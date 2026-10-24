import Link from "next/link";
import { Sparkles, Gauge, Send, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/app-shell/logo";
import { BrandDoodles } from "@/components/auth/brand-doodles";
import { GlassBackdrop } from "@/components/marketing/glass-backdrop";
import { getAppName, getTagline } from "@/lib/branding";

const HIGHLIGHTS = [
  {
    icon: Sparkles,
    title: "Every opportunity in one place",
    body: "Job alerts from your inbox become tracked leads automatically.",
  },
  {
    icon: Gauge,
    title: "AI summaries & fit scoring",
    body: "Score each role against your résumé and focus on the right ones.",
  },
  {
    icon: Send,
    title: "Apply well, on your terms",
    body: "Draft with AI, send it yourself, and never miss a follow-up.",
  },
];

/** Shared auth layout on the website's glass backdrop: a floating brand panel
 *  (desktop only) beside a frosted form card. Used by log in, sign up and the
 *  password-reset pages. */
export async function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const [appName, tagline] = await Promise.all([getAppName(), getTagline()]);
  const showTagline = tagline.show && !!tagline.text;
  return (
    <main className="relative isolate min-h-dvh lg:grid lg:grid-cols-2 lg:gap-6 lg:p-6">
      <GlassBackdrop variant="screen" />

      {/* Brand panel — desktop only, floating over the backdrop */}
      <aside className="relative hidden overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-[oklch(0.46_0.22_294)] to-[oklch(0.5_0.2_308)] p-10 text-primary-foreground shadow-2xl shadow-primary/25 ring-1 ring-white/15 lg:sticky lg:top-6 lg:flex lg:h-[calc(100dvh-3rem)] lg:flex-col lg:justify-between xl:p-12">
        <BrandDoodles />
        {/* Soft depth — glows + a top sheen so the flat gradient feels lit. */}
        <div aria-hidden className="pointer-events-none absolute -top-28 -right-24 size-96 rounded-full bg-white/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 size-[30rem] rounded-full bg-[oklch(0.62_0.21_330_/_0.22)] blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/10 to-transparent" />

        {/* Brand lockup — the mark sits on a light tile so it reads on the gradient. */}
        <Link href="/" className="relative flex w-fit items-center gap-3.5 rounded-2xl">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-white shadow-lg shadow-black/20 ring-1 ring-white/60">
            <Logo showName={false} name={appName} />
          </span>
          <span className="text-lg font-semibold tracking-tight">{appName}</span>
        </Link>

        <div className="relative">
          <h2 className="max-w-md text-[2rem] leading-[1.15] font-semibold tracking-tight xl:text-[2.2rem]">
            {showTagline ? tagline.text : "Your job search, organized end to end."}
          </h2>
          {/* Frosted cards on the gradient */}
          <ul className="mt-8 max-w-md space-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, title: t, body }) => (
              <li
                key={t}
                className="flex items-start gap-3.5 rounded-2xl bg-white/10 p-3.5 ring-1 ring-inset ring-white/20 backdrop-blur-md"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-inset ring-white/25">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="pt-0.5">
                  <p className="text-sm font-medium">{t}</p>
                  <p className="text-sm text-primary-foreground/75">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-xs text-primary-foreground/70">
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          Private by design · your data stays yours.
        </p>
      </aside>

      {/* Form panel */}
      <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10 sm:px-6 lg:min-h-[calc(100dvh-3rem)] lg:py-6">
        <div className="w-full max-w-[26rem]">
          {/* Mobile brand (the brand panel is hidden below lg). */}
          <div className="mb-6 flex flex-col items-center gap-2 text-center lg:hidden">
            <Link href="/" className="flex flex-col items-center gap-2 rounded-2xl">
              <span className="glass-strong flex size-14 items-center justify-center rounded-2xl">
                <Logo showName={false} name={appName} className="scale-110" />
              </span>
              <span className="text-base font-semibold tracking-tight">{appName}</span>
            </Link>
            {showTagline && <p className="text-xs text-muted-foreground">{tagline.text}</p>}
          </div>

          <div className="glass-strong rounded-3xl p-6 sm:p-8">
            <div className="text-center lg:text-left">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
