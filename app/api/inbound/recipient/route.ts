import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isInboundAuthorized } from "@/lib/inbound/auth";
import { checkRecipient } from "@/lib/inbound/process";

// Internal: the mail receiver asks, per RCPT TO, whether to accept a recipient
// (550 unknown / 451 forwarding off / 250 ok) — so no body is ever received for
// unknown addresses. Requires the bearer INBOUND_SECRET; Nginx also blocks
// /api/inbound/ from the internet.

const bodySchema = z.object({
  recipient: z.string().trim().min(3).max(320),
  mailFrom: z.string().trim().max(320).default(""),
});

export async function POST(request: NextRequest) {
  if (!isInboundAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  try {
    const outcome = await checkRecipient(parsed.data.recipient, parsed.data.mailFrom);
    return NextResponse.json(outcome);
  } catch {
    return NextResponse.json({ code: 451, message: "Try again later" });
  }
}
