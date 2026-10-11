import { Sparkles, Gauge, Send, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/app-shell/logo";
import { BrandDoodles } from "@/components/auth/brand-doodles";
import { getAppName, getTagline } from "@/lib/branding";

const HIGHLIGHTS = [
  {
    icon: Sparkles,
    title: "Capture leads from your inbox",
    body: "LinkedIn job alerts become tracked leads automatically.",
  },
  {
    icon: Gauge,
    title: "AI summaries & fit scoring",
    body: "Score each role against your résumé with one click.",
  },
  {
    icon: Send,
    title: "Outreach & follow-ups",
    body: "Draft messages and never miss a follow-up.",
  },
];

/** Shared two-panel auth layout: branded gradient panel + a form card. */
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
    <main className="min-h-dvh lg:grid lg:grid-cols-2">
      {/* Brand panel — desktop only */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-[oklch(0.46_0.22_294)] to-[oklch(0.5_0.2_308)] p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between xl:p-14">
        <BrandDoodles />
        {/* Soft depth — glows + a top sheen so the flat gradient feels lit. */}
        <div aria-hidden className="pointer-events-none absolute -top-28 -right-24 size-96 rounded-full bg-white/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 size-[30rem] rounded-full bg-[oklch(0.62_0.21_330_/_0.22)] blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/10 to-transparent" />

        {/* Brand lockup — the mark sits on a light tile so it reads on the gradient. */}
        <div className="relative flex items-center gap-3.5">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-white shadow-lg shadow-black/20 ring-1 ring-white/60">
            <Logo showName={false} name={appName} />
          </span>
          <span className="text-lg font-semibold tracking-tight">{appName}</span>
        </div>

        <div className="relative">
          <h2 className="max-w-md text-[2rem] leading-[1.15] font-semibold tracking-tight xl:text-[2.2rem]">
            {showTagline ? tagline.text : "Your job search, organized end to end."}
          </h2>
          <ul className="mt-9 space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, title: t, body }) => (
              <li key={t} className="flex items-start gap-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-inset ring-white/15 backdrop-blur-sm">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="pt-0.5">
                  <p className="text-sm font-medium">{t}</p>
                  <p className="text-sm text-primary-foreground/70">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-xs text-primary-foreground/65">
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          Read-only Gmail access · your data stays yours.
        </p>
      </aside>

      {/* Form panel */}
      <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-12">
        <div aria-hidden className="pointer-events-none absolute -top-24 right-0 size-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="relative w-full max-w-sm">
          {/* Mobile brand (the gradient panel is hidden below lg). */}
          <div className="mb-8 flex flex-col items-center gap-2 text-center lg:hidden">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-card shadow-md ring-1 ring-border">
              <Logo showName={false} name={appName} className="scale-110" />
            </span>
            <span className="text-base font-semibold tracking-tight">{appName}</span>
            {showTagline && <p className="text-xs text-muted-foreground">{tagline.text}</p>}
          </div>

          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          </div>

          <div className="mt-7 rounded-2xl border border-border/70 bg-card/95 p-6 shadow-xl shadow-black/5 ring-1 ring-black/[0.02] backdrop-blur-sm sm:p-7">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
