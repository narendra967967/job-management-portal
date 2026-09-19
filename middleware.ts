import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Gate the dashboard: a fast cookie-presence check only (the real session check
// happens server-side in getCurrentUserId). Unauthenticated requests to a
// dashboard route are sent to the login page.

export function middleware(request: NextRequest) {
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
