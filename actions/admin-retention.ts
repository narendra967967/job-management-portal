"use server";

// Admin → Settings → Data retention: how long each kind of log-like data is
// kept. Admin-gated, Zod-validated against the limits in lib/retention-model.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/current-user";
import { retentionConfig } from "@/db/schema";
import { parseInput } from "@/lib/schemas";
import { RETENTION_TYPES, type RetentionConfig } from "@/lib/retention-model";

const retentionSchema = z.object(
  Object.fromEntries(
    RETENTION_TYPES.map((t) => [
      t.key,
      z.coerce
        .number()
        .int(`${t.label}: use whole days.`)
        .min(t.min, `${t.label}: keep at least ${t.min} days.`)
        .max(t.max, `${t.label}: keep at most ${t.max} days.`),
    ]),
  ) as Record<keyof RetentionConfig, z.ZodNumber>,
);

export async function updateRetentionAction(input: RetentionConfig): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  try {
    const v = parseInput(retentionSchema, input) as RetentionConfig;
    await db
      .insert(retentionConfig)
      .values({ id: "app", ...v })
      .onConflictDoUpdate({ target: retentionConfig.id, set: v });
    revalidatePath("/jmp-admin/settings");
    revalidatePath("/jmp-admin/inbound-log");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't save the retention settings." };
  }
}
