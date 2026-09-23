import { redirect } from "next/navigation";
import { Sparkles, Gauge, Send } from "lucide-react";
import { Logo } from "@/components/app-shell/logo";
import { LoginForm } from "@/components/auth/sign-in";
import { getSessionUserId } from "@/lib/current-user";

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

export default async function LoginPage() {
  // Already signed in → straight to the dashboard.
  if (await getSessionUserId()) redirect("/leads");

  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-2">
      {/* Brand panel — desktop only */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary to-[oklch(0.5_0.2_305)] p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        {/* soft decorative glows */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -left-10 size-96 rounded-full bg-black/10 blur-3xl"
        />

        <div className="relative flex items-center gap-2">
          <Logo showName={false} />
          <span className="text-sm font-semibold tracking-tight">
            Job Management Portal
          </span>
        </div>

        <div className="relative">
          <h2 className="max-w-sm text-3xl leading-tight font-semibold tracking-tight">
            Your job search, organized end to end.
          </h2>
          <ul className="mt-8 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-sm text-primary-foreground/70">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          Read-only Gmail access · your data stays yours.
        </p>
      </aside>

      {/* Sign-in panel */}
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Logo shows here on mobile (brand panel is hidden) */}
          <div className="flex flex-col items-center text-center lg:hidden">
            <Logo showName={false} className="scale-110" />
          </div>

          <div className="mt-6 lg:mt-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to your workspace.
            </p>
          </div>

          <div className="mt-6 rounded-2xl border bg-card p-6 shadow-sm">
            <LoginForm />
          </div>
        </div>
      </div>
    </main>
  );
}
