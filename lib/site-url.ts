// The public base URL of this deployment (canonical links, sitemap, structured
// data). Same value Better Auth uses; falls back to localhost in development.
export function siteUrl(): string {
  return (process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/** Absolute URL for a site path. */
export function absoluteUrl(path = "/"): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
