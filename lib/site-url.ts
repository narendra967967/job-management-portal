// The public base URL of this deployment (canonical links, sitemap, structured
// data). Same value Better Auth uses; falls back to localhost in development.
export function siteUrl(): string {
  return (process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/** Absolute URL for a site path. */
export function absoluteUrl(path = "/"): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Whether search engines may index this deployment. Only the real site: any
 *  preprod / staging / dev / test host or localhost stays out of search, so a
 *  test copy never competes with (or leaks next to) the production site. */
export function isIndexable(): boolean {
  let host: string;
  try {
    host = new URL(siteUrl()).hostname;
  } catch {
    return false;
  }
  return !/(^|\.)(preprod|staging|stage|dev|test|qa|uat)[.-]|^localhost$|^127\.|\.local$|\.test$/i.test(host);
}
