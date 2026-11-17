import { NextResponse, type NextRequest } from "next/server";
import { runJob } from "@/lib/job-runs";
import { runMockInterviewJob } from "@/lib/mock-interviews/engine";

// Mock interviews housekeeping, every 5 minutes from the host crontab: closes
// interviews not resumed in time, retries reports that failed, expires old
// bookings, sends "expires soon" reminders and clears unpaid bookings. Public
// URL, so it requires the bearer CRON_SECRET and rejects otherwise before doing
// any work. Safe to call twice.

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runJob("interviews", () => runMockInterviewJob());
  return NextResponse.json({ ok: true, ...result });
}
