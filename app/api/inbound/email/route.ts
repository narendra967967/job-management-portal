import { after, NextResponse, type NextRequest } from "next/server";
import { isInboundAuthorized } from "@/lib/inbound/auth";
import { processInbound } from "@/lib/inbound/process";
import { runAiJob } from "@/lib/inbound/ai-queue";
import { MAX_BYTES_MAX } from "@/lib/email-intake-model";

// Internal: the mail receiver posts one spooled email (raw RFC 822 bytes) and
// its recipient. Answers with the SMTP-style outcome; any failure → 451 so the
// receiver keeps the message and retries. An email queued for the AI reader
// is read after the response, so the receiver is never kept waiting on the AI. Requires the bearer INBOUND_SECRET;
// Nginx also blocks /api/inbound/ from the internet.

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!isInboundAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const recipient = request.headers.get("x-inbound-recipient") ?? "";
  if (!recipient || recipient.length > 320) {
    return NextResponse.json({ error: "Missing recipient" }, { status: 400 });
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES_MAX + 64 * 1024) {
    return NextResponse.json({ code: 250, message: "Too large" });
  }
  try {
    const raw = Buffer.from(await request.arrayBuffer());
    if (raw.length > MAX_BYTES_MAX + 64 * 1024) return NextResponse.json({ code: 250, message: "Too large" });
    const { aiJobId, ...outcome } = await processInbound(raw, recipient);
    if (aiJobId) {
      after(() =>
        runAiJob(aiJobId).catch((err) =>
          console.error("[inbound] AI read failed:", err instanceof Error ? err.message : err),
        ),
      );
    }
    return NextResponse.json(outcome);
  } catch (err) {
    console.error("[inbound] processing failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ code: 451, message: "Try again later" });
  }
}
