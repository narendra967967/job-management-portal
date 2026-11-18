import "server-only";

import { NextResponse, type NextRequest } from "next/server";

// What an invoice link answers when it can't serve the PDF. A person opening
// the link in a browser gets a proper page (app/invoice-unavailable): sign in
// and come straight back, or "we can't find this invoice". Anything else (a
// script, fetch) gets a short JSON error with the right status.

export function invoiceDenied(request: NextRequest, reason: "signin" | "missing"): NextResponse {
  const wantsPage = (request.headers.get("accept") ?? "").includes("text/html");
  if (!wantsPage) {
    return reason === "signin"
      ? NextResponse.json({ error: "Sign in first." }, { status: 401 })
      : NextResponse.json({ error: "No invoice for this payment." }, { status: 404 });
  }
  const url = new URL("/invoice-unavailable", request.nextUrl.origin);
  url.searchParams.set("reason", reason);
  if (reason === "signin") url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url, 303);
}
