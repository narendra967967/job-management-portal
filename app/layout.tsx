import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { getAppName, getBranding, getTagline } from "@/lib/branding";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Title + favicon are admin-controlled (Settings → General → Branding), so the
// whole site reflects changes without a code deploy.
export async function generateMetadata(): Promise<Metadata> {
  const [appName, tagline, branding] = await Promise.all([getAppName(), getTagline(), getBranding()]);
  return {
    title: tagline.show && tagline.text ? `${appName} — ${tagline.text}` : appName,
    description:
      "Capture LinkedIn job-alert leads and manage AI-assisted outreach in one place.",
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
