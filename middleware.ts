import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Gate the dashboard: a fast cookie-presence check only (the real session check
// happens server-side in the dashboard layout / getCurrentUserId). Requests to a
// dashboard route without a session cookie are sent to the home page.
//
// It also passes the path to the layout as x-pathname (overwriting anything the
// client sent), so the layout can keep an expired user (limited mode) on the
// pages they may still use.

export function middleware(request: NextRequest) {
  const cookie = getSessionCookie(request);
  if (!cookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
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
  ],
};
