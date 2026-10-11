"use client";

// Public marketing header — sticky, translucent-on-scroll, with smooth-scroll
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
    <header
      className={cn(
        "sticky top-0 z-50 transition-colors duration-300",
        scrolled
          ? "border-b border-border/60 bg-background/80 backdrop-blur-lg"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/#home" className="flex items-center gap-2.5" aria-label={appName}>
          <Logo showName={false} name={appName} />
          <span className="text-base font-semibold tracking-tight">{appName}</span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
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
                className="rounded-lg px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
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
          className="ml-auto inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-x-0 top-0 animate-in slide-in-from-top-4 duration-200 border-b bg-background p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <Link href="/#home" onClick={() => setOpen(false)} className="flex items-center gap-2.5">
                <Logo showName={false} name={appName} />
                <span className="text-base font-semibold tracking-tight">{appName}</span>
              </Link>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
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
                  className="rounded-lg px-3 py-3 text-sm font-medium text-foreground hover:bg-muted"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="mt-3 flex flex-col gap-2 border-t pt-4">
              {loggedIn ? (
                <Link
                  href="/leads"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
                >
                  Go to dashboard <ArrowRight className="size-4" aria-hidden />
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted"
                  >
                    Log in
                  </Link>
                  {signupAllowed && (
                    <Link
                      href="/signup"
                      onClick={() => setOpen(false)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
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
