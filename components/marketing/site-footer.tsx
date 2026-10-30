// Public marketing footer — brand, quick nav, legal links, copyright.

import Link from "next/link";
import { Logo } from "@/components/app-shell/logo";

export function SiteFooter({ appName, tagline }: { appName: string; tagline?: string }) {
  const year = new Date().getFullYear();
  return (
    <footer className="glass-subtle mt-8 rounded-none border-x-0 border-b-0">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-xs">
          <Link href="/#home" className="flex items-center gap-2.5">
            <Logo showName={false} name={appName} />
            <span className="text-base font-semibold tracking-tight">{appName}</span>
          </Link>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {tagline || "Your job search, organized end to end."}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Product</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/#features" className="text-muted-foreground hover:text-foreground">Features</Link></li>
            <li><Link href="/pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link></li>
            <li><Link href="/#about" className="text-muted-foreground hover:text-foreground">About</Link></li>
            <li><Link href="/#contact" className="text-muted-foreground hover:text-foreground">Contact</Link></li>
            <li><Link href="/login" className="text-muted-foreground hover:text-foreground">Log in</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Legal</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/privacy" className="text-muted-foreground hover:text-foreground">Privacy policy</Link></li>
            <li><Link href="/terms" className="text-muted-foreground hover:text-foreground">Terms &amp; conditions</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>© {year} {appName}. All rights reserved.</p>
          <p>Your data is never sold or used for advertising.</p>
        </div>
      </div>
    </footer>
  );
}
