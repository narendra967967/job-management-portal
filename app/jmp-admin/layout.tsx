import type { Metadata } from "next";

// The admin panel is never indexed (and isn't listed in robots.txt or the sitemap).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
