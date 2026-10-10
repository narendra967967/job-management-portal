import { headers } from "next/headers";
import { authAdmin } from "@/lib/auth-admin";
import { subscribe, type SupportEvent } from "@/lib/support-events";

// Live support events for the admin inbox (SSE). Admin sees ALL tickets, so every
// event is pushed; the client filters by whichever ticket it's viewing.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await authAdmin.api.getSession({ headers: await headers() });
  const u = session?.user as { role?: string } | undefined;
  if (!u || u.role !== "admin") return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  let unsub = () => {};
  let ping: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          /* closed */
        }
      };
      send({ type: "hello" });
      unsub = subscribe((e: SupportEvent) => send(e));
      ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* closed */
        }
      }, 25000);
      req.signal.addEventListener("abort", () => {
        if (ping) clearInterval(ping);
        unsub();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      if (ping) clearInterval(ping);
      unsub();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
