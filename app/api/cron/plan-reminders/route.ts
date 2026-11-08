import { NextResponse, type NextRequest } from "next/server";
import { runPlanReminders } from "@/lib/plan-reminders";

// Renewal reminders (7 … 1 days before a plan ends). Called once a day, around
// 10:00 IST, by the host crontab. Public URL, so it requires the bearer
// CRON_SECRET and rejects otherwise before doing any work. Safe to call twice.

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runPlanReminders();
  return NextResponse.json({ ok: true, ...result });
}
