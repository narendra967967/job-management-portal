import { NextResponse, type NextRequest } from "next/server";
import { runBroadcasts } from "@/lib/broadcasts-send";

// Broadcast sender — called every few minutes by the server crontab. Starts
// scheduled sends that are due and works through the email queue, paced (see
// lib/broadcasts-send.ts). Send now also runs it straight away. Public URL by
// necessity, so it requires the bearer CRON_SECRET and rejects otherwise before
// doing any work.

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runBroadcasts();
  return NextResponse.json({ ok: true, ...result });
}
