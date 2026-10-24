"use client";

// Public marketing header — a floating glass bar (firmer once you scroll), with smooth-scroll
// anchor nav (Home/Features/About/Contact are sections on the landing page) and
// auth CTAs. "Sign up" shows only when the admin has self-registration enabled;
// a signed-in visitor sees "Dashboard" instead of the auth buttons.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, ArrowRight } from "lucide-react";
import { Logo } from "@/components/app-shell/logo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/#home", label: "Home" },
  { href: "/#features", label: "Features" },
  { href: "/#about", label: "About" },
  { href: "/#faq", label: "FAQ" },
  { href: "/#contact", label: "Contact" },
];

export function SiteHeader({
  appName,
  signupAllowed,
  loggedIn,
}: {
  appName: string;
  signupAllowed: boolean;
  loggedIn: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock scroll while the mobile menu is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-4">
      <div
        className={cn(
          "mx-auto flex h-14 max-w-6xl items-center gap-4 rounded-2xl px-3 transition-all duration-300 sm:h-16 sm:px-5",
          scrolled ? "glass-strong" : "glass-subtle",
        )}
      >
        <Link href="/#home" className="flex items-center gap-2.5" aria-label={appName}>
          <Logo showName={false} name={appName} />
          <span className="text-base font-semibold tracking-tight">{appName}</span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/50 hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 whitespace-nowrap lg:flex">
          {loggedIn ? (
            <Link
              href="/leads"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:translate-y-px"
            >
              Go to dashboard <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white/60"
              >
                Log in
              </Link>
              {signupAllowed && (
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:translate-y-px"
                >
                  Get started <ArrowRight className="size-4" aria-hidden />
                </Link>
              )}
            </>
          )}
        </div>

        {/* Mobile trigger */}
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="ml-auto inline-flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-white/60 hover:text-foreground lg:hidden"
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[oklch(0.25_0.06_277_/_0.3)] backdrop-blur-[2px]"
          />
          <div className="glass-strong absolute inset-x-3 top-3 animate-in slide-in-from-top-4 rounded-2xl p-4 duration-200">
            <div className="flex items-center justify-between">
              <Link href="/#home" onClick={() => setOpen(false)} className="flex items-center gap-2.5">
                <Logo showName={false} name={appName} />
                <span className="text-base font-semibold tracking-tight">{appName}</span>
              </Link>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="inline-flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-white/60 hover:text-foreground"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <nav className="mt-4 flex flex-col">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-3 text-sm font-medium text-foreground hover:bg-white/60"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="mt-3 flex flex-col gap-2 border-t border-white/70 pt-4">
              {loggedIn ? (
                <Link
                  href="/leads"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm"
                >
                  Go to dashboard <ArrowRight className="size-4" aria-hidden />
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="glass-subtle inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-white/70"
                  >
                    Log in
                  </Link>
                  {signupAllowed && (
                    <Link
                      href="/signup"
                      onClick={() => setOpen(false)}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm"
                    >
                      Get started <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
