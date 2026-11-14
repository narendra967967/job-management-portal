"use server";

// Admin dashboard → Edit dashboard: saves the signed-in admin's own block order
// and hidden blocks. Admin-gated and Zod-validated; unknown block ids are
// dropped by normalizeLayout, so only real blocks are ever stored.

import { requireAdmin } from "@/lib/current-user";
import { parseInput } from "@/lib/schemas";
import { layoutInputSchema, setDashboardLayout } from "@/lib/admin/dashboard-layout";

export async function saveDashboardLayoutAction(input: { order: string[]; hidden: string[] }): Promise<{ ok: true } | { ok: false; error: string }> {
  const adminId = await requireAdmin();
  try {
    await setDashboardLayout(adminId, parseInput(layoutInputSchema, input));
    return { ok: true };
  } catch (e) {
    console.error("[dashboard] couldn't save a layout:", e instanceof Error ? e.message : e);
    return { ok: false, error: "Couldn't save your layout. Try again." };
  }
}
