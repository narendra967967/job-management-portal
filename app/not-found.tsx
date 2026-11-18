import type { Metadata } from "next";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import { GlassNotice } from "@/components/marketing/glass-notice";
import { getAppName } from "@/lib/branding";

// App-wide 404 — any unknown URL (public site, dashboard or admin). Standalone
// glass page in the website's style; no session lookups.

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

export default async function NotFound() {
  const appName = await getAppName();
  return (
    <GlassNotice
      appName={appName}
      badge={
        <p className="bg-gradient-to-br from-primary to-[oklch(0.5_0.2_308)] bg-clip-text text-6xl font-semibold tracking-tight text-transparent sm:text-7xl">
          404
        </p>
      }
      title="Page not found"
      message={<>The page you&apos;re looking for doesn&apos;t exist or has moved.</>}
      actions={[
        { href: "/", label: "Back to home", icon: ArrowLeft, primary: true },
        { href: "/leads", label: "Go to Leads", icon: LayoutGrid },
      ]}
    />
  );
}
