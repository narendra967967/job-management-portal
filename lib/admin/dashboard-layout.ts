import "server-only";

// Each admin's dashboard layout (admin_dashboard_layouts), read by the
// dashboard page and written by actions/admin-dashboard.ts. No row = default.

import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { adminDashboardLayouts } from "@/db/schema";
import { defaultLayout, isDefaultLayout, normalizeLayout, type DashboardLayout } from "@/lib/admin/dashboard-model";

const blockList = z.array(z.string().trim().min(1).max(40)).max(40);
/** What Edit dashboard may send. Ids are checked against BLOCKS by normalizeLayout. */
export const layoutInputSchema = z.object({ order: blockList, hidden: blockList });

export async function getDashboardLayout(userId: string): Promise<DashboardLayout> {
  const [row] = await db
    .select({ order: adminDashboardLayouts.blockOrder, hidden: adminDashboardLayouts.hidden })
    .from(adminDashboardLayouts)
    .where(eq(adminDashboardLayouts.userId, userId))
    .limit(1);
  return row ? normalizeLayout(row) : defaultLayout();
}

/** Saves a layout for one admin. The default layout is stored as no row. */
export async function setDashboardLayout(userId: string, layout: { order: string[]; hidden: string[] }): Promise<DashboardLayout> {
  const clean = normalizeLayout(layout);
  if (isDefaultLayout(clean)) {
    await db.delete(adminDashboardLayouts).where(eq(adminDashboardLayouts.userId, userId));
    return clean;
  }
  const values = { blockOrder: clean.order as string[], hidden: clean.hidden as string[] };
  await db
    .insert(adminDashboardLayouts)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: adminDashboardLayouts.userId, set: values });
  return clean;
}
