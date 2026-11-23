import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/current-user";
import { leaveInterview } from "@/lib/mock-interviews/engine";
import { siteUrl } from "@/lib/site-url";

// The interview screen says the candidate left it (another page in the app, a
// reload or a closed tab), so the interview pauses now rather than after the
// 45-second heartbeat gap (spec D13f). A route, not a Server Action, because a
// closing tab can only send it with navigator.sendBeacon.
//
// It can only pause the caller's own running interview, and only from our own
// pages: a request from another site is refused. Nothing comes back.

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get("origin");
  // The public address (behind the proxy) or the one the request came in on (local).
  if (origin && origin !== new URL(siteUrl()).origin && origin !== request.nextUrl.origin) return new NextResponse(null, { status: 403 });
  const userId = await getSessionUserId();
  if (!userId) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return new NextResponse(null, { status: 404 });
  await leaveInterview(userId, id);
  return new NextResponse(null, { status: 204 });
}
