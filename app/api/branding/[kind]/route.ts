import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appAssets } from "@/db/schema";

// Serves the admin-managed branding assets site-wide. A missing logo falls back
// to the bundled default; a missing favicon is simply 404 (no default emitted).
// Short cache + must-revalidate so admin changes show up promptly.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = new Set(["logo", "favicon"]);

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!KINDS.has(kind)) return new Response("Not found", { status: 404 });

  const [row] = await db.select().from(appAssets).where(eq(appAssets.kind, kind)).limit(1);

  if (row) {
    return new Response(new Uint8Array(row.data), {
      headers: {
        "Content-Type": row.contentType,
        "Cache-Control": "public, max-age=60, must-revalidate",
      },
    });
  }

  // Fallback: the bundled default logo so the UI always has a mark to show.
  if (kind === "logo") {
    try {
      const bytes = await readFile(path.join(process.cwd(), "public", "logo.png"));
      return new Response(new Uint8Array(bytes), {
        headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=60, must-revalidate" },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }

  return new Response("Not found", { status: 404 });
}
