import { NextResponse, type NextRequest } from "next/server";
import { runLeadPurge } from "@/lib/lead-purge";

// Stale-lead purge endpoint — called on a (daily) schedule by GitHub Actions.
// Public URL, so it requires the bearer CRON_SECRET and rejects otherwise before
// doing any work. No-op unless Lead retention is enabled in admin Settings → Cron.

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runLeadPurge();
  return NextResponse.json({ ok: true, ...result });
}
