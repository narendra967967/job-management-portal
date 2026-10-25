import type { MetadataRoute } from "next";
import { absoluteUrl, isIndexable } from "@/lib/site-url";

// Per request, never at build time: the Docker build has no BETTER_AUTH_URL,
// so a build-time robots.txt saw "localhost" and blocked the live site.
export const dynamic = "force-dynamic";

// Crawl the public site. Private areas (dashboard, admin, account pages) are
// NOT listed here — that would publish their paths; they carry a noindex meta
// tag instead, which crawlers can only see if they're allowed to fetch them.
export default function robots(): MetadataRoute.Robots {
  // Preprod / staging / local copies: keep every crawler out.
  if (!isIndexable()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
