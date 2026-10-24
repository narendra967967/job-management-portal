import { NextResponse, type NextRequest } from "next/server";
import { sweepAiQueue } from "@/lib/inbound/ai-queue";

// AI reader sweep — called every few minutes by the server crontab. Emails are
// normally read right after they arrive; this picks up retries and anything an
// app restart interrupted. Public URL by necessity, so it requires the bearer
// CRON_SECRET and rejects otherwise before doing any work.

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sweepAiQueue();
  return NextResponse.json({ ok: true, ...result });
}
