"use server";

// Admin → Email intake: forwarding settings, the Connect Gmail switch, the
// allowed senders list, and per-user address resets. Every action is
// admin-gated and Zod-validated. Spec: docs/email-forwarding.md (A1–A6).

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/current-user";
import { emailIntakeConfig as configT, inboundSenders as sendersT } from "@/db/schema";
import {
  gmailSwitchSchema,
  inboundSenderSchema,
  intakeSettingsSchema,
  parseInput,
  zId,
  type InboundSenderInput,
} from "@/lib/schemas";
import { getIntakeConfig, loadSenders, resetForwarding } from "@/lib/email-intake-data";
import { disconnectAllGoogle } from "@/lib/gmail";
import type { InboundParser, InboundSender } from "@/lib/email-intake-model";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function refresh() {
  revalidatePath("/jmp-admin/settings");
  revalidatePath("/jmp-admin/dashboard");
  revalidatePath("/jmp-admin/users");
  revalidatePath("/jmp-admin/inbound-log");
}

const fail = (e: unknown, fallback: string) => ({
  ok: false as const,
  error: e instanceof Error ? e.message : fallback,
});

/* ---------------- A1: forwarding settings ---------------- */

export async function updateIntakeSettingsAction(input: { forwardingEnabled: boolean; maxBytes: number }): Promise<Result> {
  await requireAdmin();
  try {
    const v = parseInput(intakeSettingsSchema, input);
    await db
      .insert(configT)
      .values({ id: "app", ...v })
      .onConflictDoUpdate({ target: configT.id, set: v });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't save the settings.");
  }
}

/* ---------------- A6: Connect Gmail switch ---------------- */

/** Off: revokes every Google connection at Google and deletes the tokens. */
export async function setGmailOAuthEnabledAction(input: { enabled: boolean }): Promise<Result<{ disconnected: number }>> {
  const adminId = await requireAdmin();
  try {
    const { enabled } = parseInput(gmailSwitchSchema, input);
    // Flip the switch first so no new link/sync can start while we revoke.
    await db
      .insert(configT)
      .values({ id: "app", gmailOAuthEnabled: enabled, gmailToggledAt: new Date(), gmailToggledBy: adminId })
      .onConflictDoUpdate({
        target: configT.id,
        set: { gmailOAuthEnabled: enabled, gmailToggledAt: new Date(), gmailToggledBy: adminId },
      });
    const disconnected = enabled ? 0 : await disconnectAllGoogle();
    refresh();
    revalidatePath("/settings");
    return { ok: true, disconnected };
  } catch (e) {
    return fail(e, "Couldn't change Connect Gmail.");
  }
}

/* ---------------- A2: allowed senders ---------------- */

async function assertSomeEnabled(): Promise<void> {
  const senders = await loadSenders();
  if (!senders.some((s) => s.enabled)) {
    throw new Error("Keep at least one sender enabled, or turn email forwarding off instead.");
  }
}

function toRow(v: InboundSenderInput) {
  return { ...v, parser: v.parser as InboundParser };
}

export async function createSenderAction(input: InboundSenderInput): Promise<Result<{ sender: InboundSender }>> {
  await requireAdmin();
  try {
    const v = parseInput(inboundSenderSchema, input);
    const [row] = await db.insert(sendersT).values(toRow(v)).onConflictDoNothing().returning();
    if (!row) return { ok: false, error: "That sender is already on the list." };
    refresh();
    return { ok: true, sender: { id: row.id, match: row.match, signingDomain: row.signingDomain, parser: row.parser, enabled: row.enabled } };
  } catch (e) {
    return fail(e, "Couldn't add the sender.");
  }
}

export async function updateSenderAction(id: string, input: InboundSenderInput): Promise<Result> {
  await requireAdmin();
  try {
    const sid = parseInput(zId, id);
    const v = parseInput(inboundSenderSchema, input);
    const [clash] = await db
      .select({ id: sendersT.id })
      .from(sendersT)
      .where(and(eq(sendersT.match, v.match), ne(sendersT.id, sid)));
    if (clash) return { ok: false, error: "That sender is already on the list." };
    return await db.transaction(async (tx) => {
      const res = await tx.update(sendersT).set(toRow(v)).where(eq(sendersT.id, sid)).returning({ id: sendersT.id });
      if (!res.length) throw new Error("Sender not found.");
      // Rolls back the edit if it would leave no sender enabled.
      const stillEnabled = await tx.select({ id: sendersT.id }).from(sendersT).where(eq(sendersT.enabled, true)).limit(1);
      if (!stillEnabled.length) throw new Error("Keep at least one sender enabled, or turn email forwarding off instead.");
      refresh();
      return { ok: true as const };
    });
  } catch (e) {
    return fail(e, "Couldn't save the sender.");
  }
}

export async function setSenderEnabledAction(id: string, enabled: boolean): Promise<Result> {
  await requireAdmin();
  try {
    const sid = parseInput(zId, id);
    await db.update(sendersT).set({ enabled: !!enabled }).where(eq(sendersT.id, sid));
    try {
      await assertSomeEnabled();
    } catch (e) {
      await db.update(sendersT).set({ enabled: true }).where(eq(sendersT.id, sid)); // undo
      throw e;
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't update the sender.");
  }
}

export async function deleteSenderAction(id: string): Promise<Result> {
  await requireAdmin();
  try {
    const sid = parseInput(zId, id);
    const senders = await loadSenders();
    const target = senders.find((s) => s.id === sid);
    if (!target) return { ok: false, error: "Sender not found." };
    if (target.enabled && !senders.some((s) => s.enabled && s.id !== sid)) {
      return { ok: false, error: "Keep at least one sender enabled, or turn email forwarding off instead." };
    }
    await db.delete(sendersT).where(eq(sendersT.id, sid));
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't remove the sender.");
  }
}

/* ---------------- A4: reset a user's address ---------------- */

export async function resetUserForwardingAction(userId: string): Promise<Result> {
  await requireAdmin();
  try {
    await resetForwarding(parseInput(zId, userId));
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't reset the address.");
  }
}

/** Fresh config for the settings card after a save. */
export async function getIntakeConfigAction() {
  await requireAdmin();
  return getIntakeConfig();
}
