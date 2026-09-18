import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Gate the dashboard when auth is enabled (Google creds configured). This is a
// fast cookie-presence check only — the real session/allow-list check happens
// server-side in getCurrentUserId. When auth is off (no Google creds yet), the
// app is open for local dev.

export function middleware(request: NextRequest) {
  const authEnabled =
    !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
  if (!authEnabled) return NextResponse.next();

  const cookie = getSessionCookie(request);
  if (!cookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/leads/:path*",
    "/todo/:path*",
    "/contacts/:path*",
    "/outreach/:path*",
    "/reminders/:path*",
    "/settings/:path*",
  ],
};
