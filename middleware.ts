import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Gate the dashboard: a fast cookie-presence check only (the real session check
// happens server-side in the dashboard layout / getCurrentUserId). Requests to a
// dashboard route without a session cookie go to the login page with
// ?next=<the page they asked for>, so a link from an email (report ready,
// invoice, plan ending…) lands on that page after signing in. The login page
// only follows next= paths inside the app (lib/safe-next.ts).
//
// It also passes the path to the layout as x-pathname, and the path with its
// query as x-return-to (both overwriting anything the client sent), so the
// layout can keep an expired user (limited mode) on the pages they may still
// use, and so a session that has expired behind a still-present cookie can also
// be sent back to the right page after signing in (lib/current-user.ts).

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const cookie = getSessionCookie(request);
  if (!cookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);
  headers.set("x-return-to", pathname + search);
  return NextResponse.next({ request: { headers } });
}

// Every route in app/(dashboard).
export const config = {
  matcher: [
    "/leads/:path*",
    "/todo/:path*",
    "/contacts/:path*",
    "/outreach/:path*",
    "/outreached/:path*",
    "/reminders/:path*",
    "/settings/:path*",
    "/archive/:path*",
    "/guides/:path*",
    "/notifications/:path*",
    "/ready/:path*",
    "/support/:path*",
    "/upgrade/:path*",
    "/mock-interviews/:path*",
    "/orders/:path*",
  ],
};
