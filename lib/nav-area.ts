// The signed-in app has two main menus (docs/interview-prep/spec.md, D2):
// Lead management (the job tracker) and Mock interviews (the Interview
// Preparation module). Shared pages (Settings, Help, guides, notifications,
// Upgrade Plan) belong to neither, so the menu keeps whichever area was open.
// Client-safe: no server imports.

export type NavArea = "leads" | "mock";

export const MOCK_INTERVIEWS_HOME = "/mock-interviews/ai";
export const LEADS_HOME = "/leads";

/** Every Mock interviews page lives under this path. */
export const MOCK_INTERVIEWS_ROOT = "/mock-interviews";

const LEAD_PATHS = ["/leads", "/ready", "/outreached", "/archive", "/todo", "/reminders", "/contacts", "/outreach"];

const under = (pathname: string, p: string) => pathname === p || pathname.startsWith(`${p}/`);

/** The area a page belongs to, or null for shared pages. */
export function areaForPath(pathname: string): NavArea | null {
  if (under(pathname, MOCK_INTERVIEWS_ROOT)) return "mock";
  if (LEAD_PATHS.some((p) => under(pathname, p))) return "leads";
  return null;
}
