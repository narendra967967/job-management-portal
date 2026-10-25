import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { getAppName, getBranding, getTagline } from "@/lib/branding";
import { siteUrl } from "@/lib/site-url";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Title + favicon are admin-controlled (Settings → General → Branding), so the
// whole site reflects changes without a code deploy.
export async function generateMetadata(): Promise<Metadata> {
  const [appName, tagline, branding] = await Promise.all([getAppName(), getTagline(), getBranding()]);
  const fallbackTitle = tagline.show && tagline.text ? `${appName}: ${tagline.text}` : appName;
  const description =
    "Job application tracker with AI. Turn job alerts into leads, score roles against your résumé and follow up on every application.";
  return {
    metadataBase: new URL(siteUrl()),
    // Pages set their own title; it becomes "Title · Jobtiva".
    title: { default: fallbackTitle, template: `%s · ${appName}` },
    description,
    applicationName: appName,
    openGraph: { type: "website", siteName: appName, title: fallbackTitle, description, locale: "en_IN" },
    twitter: { card: "summary_large_image", title: fallbackTitle, description },
    icons: branding.hasFavicon
      ? { icon: [{ url: `/api/branding/favicon?v=${branding.faviconVersion}` }] }
      : undefined,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4F46E5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
