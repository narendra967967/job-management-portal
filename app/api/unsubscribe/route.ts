import { NextResponse, type NextRequest } from "next/server";
import { setPromoOptOutByToken } from "@/lib/unsubscribe";

// The List-Unsubscribe target in promotional emails. Mail apps' one-click
// button POSTs here (RFC 8058) and promotional messages turn off straight away;
// the signed token is the only key, so no sign-in. A plain GET (an older mail
// app, or someone pasting the link) goes to the page instead, which does the
// same from the browser and offers an undo.

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t") ?? "";
  const ok = await setPromoOptOutByToken(token, true);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/unsubscribe";
  return NextResponse.redirect(url, 303);
}
