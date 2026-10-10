import { getSessionUser } from "@/lib/current-user";
import { subscribe, type SupportEvent } from "@/lib/support-events";

// Live support events for the signed-in user (SSE). Only events for this user's
// own tickets are pushed. Node runtime + no buffering so the stream flushes
// immediately (incl. behind Nginx, via X-Accel-Buffering).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

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
      unsub = subscribe((e: SupportEvent) => {
        if (e.ownerUserId === user.id) send(e);
      });
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
