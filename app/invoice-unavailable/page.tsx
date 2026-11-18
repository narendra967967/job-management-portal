import type { Metadata } from "next";
import { ArrowLeft, FileX, Lock, LogIn, Receipt, UserPlus } from "lucide-react";
import { GlassNotice, type NoticeAction } from "@/components/marketing/glass-notice";
import { getAppName } from "@/lib/branding";
import { isRegistrationOpen } from "@/lib/plans";
import { safeNextPath } from "@/lib/safe-next";

// Where an invoice link sends a browser it can't serve (lib/invoices/denied.ts):
// signed out → sign in (and come straight back), or not this account's invoice
// / no such invoice → Orders & payments. Same glass look as the 404 page.

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };

const badge = (Icon: typeof Lock) => (
  <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[oklch(0.5_0.2_308)] text-white shadow-sm">
    <Icon className="size-8" aria-hidden />
  </span>
);

export default async function InvoiceUnavailablePage({ searchParams }: { searchParams: Promise<{ reason?: string; next?: string }> }) {
  const sp = await searchParams;
  const [appName, signupOpen] = await Promise.all([getAppName(), isRegistrationOpen()]);

  if (sp.reason === "signin") {
    const next = safeNextPath(sp.next);
    const actions: NoticeAction[] = [
      { href: next ? `/login?next=${encodeURIComponent(next)}` : "/login", label: "Sign in", icon: LogIn, primary: true },
      signupOpen ? { href: "/signup", label: "Create an account", icon: UserPlus } : { href: "/", label: "Back to home", icon: ArrowLeft },
    ];
    return (
      <GlassNotice
        appName={appName}
        badge={badge(Lock)}
        title="Sign in to see this invoice"
        message="Invoices are private. Sign in with the account that paid, and the invoice opens straight after."
        actions={actions}
      />
    );
  }

  return (
    <GlassNotice
      appName={appName}
      badge={badge(FileX)}
      title="We can't find this invoice"
      message="It may belong to another account, or the link may be incomplete. Every invoice you've paid for is in Orders & payments."
      actions={[
        { href: "/orders", label: "Go to Orders & payments", icon: Receipt, primary: true },
        { href: "/", label: "Back to home", icon: ArrowLeft },
      ]}
    />
  );
}
