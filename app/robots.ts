import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site-url";

// Crawl the public site. Private areas (dashboard, admin, account pages) are
// NOT listed here — that would publish their paths; they carry a noindex meta
// tag instead, which crawlers can only see if they're allowed to fetch them.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
