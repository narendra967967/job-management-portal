import { NextResponse, type NextRequest } from "next/server";
import { runSyncForAllUsers } from "@/lib/gmail-sync";

// Gmail sync endpoint — called on a schedule by GitHub Actions (TRD §9). Public
// URL by necessity, so it requires the bearer CRON_SECRET and rejects otherwise
// before doing any work.

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runSyncForAllUsers();
  return NextResponse.json({ ok: true, results });
}
