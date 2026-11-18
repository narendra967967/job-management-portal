import "server-only";

// The logo as an invoice keeps it (docs/invoices/spec.md, section 3): the logo
// uploaded in admin Settings → Branding, shrunk to a small PNG (PDFs take PNG
// or JPEG only, and an uploaded SVG or WebP is converted). Copied into each
// invoice at payment, so a later logo change never alters an issued invoice.
// No uploaded logo means the invoice shows the app name only.

import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appAssets } from "@/db/schema";

/** Big enough to stay sharp at 30pt when printed, small enough to keep each invoice light. */
const SIZE_PX = 160;

export async function logoForInvoice(): Promise<string | null> {
  const [row] = await db.select({ data: appAssets.data }).from(appAssets).where(eq(appAssets.kind, "logo")).limit(1);
  if (!row) return null;
  try {
    const png = await sharp(Buffer.from(row.data)).resize(SIZE_PX, SIZE_PX, { fit: "inside" }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch (e) {
    console.error("[invoices] couldn't read the uploaded logo:", e instanceof Error ? e.message : e);
    return null;
  }
}
