import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { getAppName, getBranding } from "@/lib/branding";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Title + favicon are admin-controlled (Settings → General → Branding), so the
// whole site reflects changes without a code deploy.
export async function generateMetadata(): Promise<Metadata> {
  const [appName, branding] = await Promise.all([getAppName(), getBranding()]);
  return {
    title: appName,
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
