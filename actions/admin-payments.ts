"use server";

// Admin → Settings → Payments and Orders & payments. Admin-guarded and
// Zod-validated. Gateway secrets are encrypted at rest and write-only: the
// screen only learns whether each one is set.

import { and, desc, gte, lte, eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { paymentGateways, paymentOrders } from "@/db/schema";
import { requireAdmin } from "@/lib/current-user";
import { encryptSecret } from "@/lib/crypto";
import { credsOf, gatewayComplete, getGatewayRow, listGatewaySettings } from "@/lib/payments/gateways";
import { KEY_ID_RE, ping, RazorpayError } from "@/lib/payments/razorpay";
import { receiptOf, sendReceipt } from "@/lib/payments/orders";
import { SMTP_NOT_CONFIGURED } from "@/lib/email";
import type { AdminOrderRow, GatewaySettings } from "@/lib/billing-model";

type Result = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/jmp-admin/settings");
}

export async function getGatewaysAction(): Promise<GatewaySettings[]> {
  await requireAdmin();
  return listGatewaySettings();
}

const saveSchema = z.object({
  id: z.literal("razorpay"),
  mode: z.enum(["test", "live"]),
  keyId: z.string().trim().max(64),
  keySecret: z.string().trim().max(128).optional().default(""),
  webhookSecret: z.string().trim().max(128).optional().default(""),
});

export async function saveGatewayAction(raw: unknown): Promise<Result> {
  const adminId = await requireAdmin();
  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const v = parsed.data;

  if (v.keyId && !KEY_ID_RE.test(v.keyId)) {
    return { ok: false, error: "That doesn't look like a Razorpay key ID (rzp_test_… or rzp_live_…)." };
  }
  if (v.keyId && !v.keyId.startsWith(`rzp_${v.mode}_`)) {
    return { ok: false, error: `The key ID is a ${v.mode === "live" ? "test" : "live"} key, but the mode is ${v.mode}.` };
  }

  const cur = await getGatewayRow(v.id);
  // A new key ID or mode means a new key pair: its secret must come with it.
  const keyChanged = (cur?.keyId ?? "") !== v.keyId || (cur?.mode ?? "test") !== v.mode;
  if (keyChanged && v.keyId && !v.keySecret) {
    return { ok: false, error: "Enter the key secret that goes with this key ID." };
  }
  const clearingKeys = !v.keyId;
  if (cur?.enabled && clearingKeys) {
    return { ok: false, error: "Turn the gateway off before removing its keys." };
  }

  const values = {
    mode: v.mode,
    keyId: v.keyId || null,
    ...(clearingKeys
      ? { keySecretCiphertext: null }
      : v.keySecret
        ? { keySecretCiphertext: encryptSecret(v.keySecret) }
        : {}),
    ...(v.webhookSecret ? { webhookSecretCiphertext: encryptSecret(v.webhookSecret) } : {}),
    // A changed key hasn't been tested yet.
    ...(keyChanged || v.keySecret ? { lastTestOk: null, lastTestAt: null } : {}),
    updatedBy: adminId,
  };
  await db
    .insert(paymentGateways)
    .values({ id: v.id, ...values })
    .onConflictDoUpdate({ target: paymentGateways.id, set: values });
  revalidate();
  return { ok: true };
}

const switchSchema = z.object({ id: z.literal("razorpay"), enabled: z.boolean() });

export async function setGatewayEnabledAction(raw: unknown): Promise<Result> {
  const adminId = await requireAdmin();
  const parsed = switchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { id, enabled } = parsed.data;
  const cur = await getGatewayRow(id);
  if (enabled && !gatewayComplete(cur)) {
    return { ok: false, error: "Save the key ID, key secret and webhook secret before turning it on." };
  }
  await db.update(paymentGateways).set({ enabled, updatedBy: adminId }).where(eq(paymentGateways.id, id));
  revalidate();
  return { ok: true };
}

export async function testGatewayAction(raw: unknown): Promise<Result> {
  await requireAdmin();
  const parsed = z.object({ id: z.literal("razorpay") }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const row = await getGatewayRow(parsed.data.id);
  const creds = row ? credsOf(row) : null;
  if (!row || !creds) return { ok: false, error: "Save the key ID and key secret first, then test again." };

  let error = "";
  try {
    await ping(creds);
  } catch (err) {
    error =
      err instanceof RazorpayError && (err.status === 401 || err.status === 400)
        ? "Razorpay didn't accept these keys. Check the key ID and secret."
        : err instanceof Error
          ? err.message
          : "Couldn't reach Razorpay.";
  }
  await db
    .update(paymentGateways)
    .set({ lastTestOk: !error, lastTestAt: new Date() })
    .where(eq(paymentGateways.id, row.id));
  revalidate();
  return error ? { ok: false, error } : { ok: true };
}

/* ---------------- Orders & payments ---------------- */

const rangeSchema = z.object({ from: z.string().datetime(), to: z.string().datetime() });
const MAX_ROWS = 5000;

/** Orders created in [from, to] (ISO instants; the screen sends the viewer's
 *  local day bounds). Newest first. */
export async function listOrdersAction(raw: unknown): Promise<{ rows: AdminOrderRow[]; capped: boolean }> {
  await requireAdmin();
  const parsed = rangeSchema.safeParse(raw);
  if (!parsed.success) return { rows: [], capped: false };
  const from = new Date(parsed.data.from);
  const to = new Date(parsed.data.to);
  const list = await db
    .select()
    .from(paymentOrders)
    .where(and(gte(paymentOrders.createdAt, from), lte(paymentOrders.createdAt, to)))
    .orderBy(desc(paymentOrders.createdAt))
    .limit(MAX_ROWS + 1);
  return {
    capped: list.length > MAX_ROWS,
    rows: list.slice(0, MAX_ROWS).map((o) => ({
      id: o.id,
      createdAt: o.createdAt.toISOString(),
      paidAt: o.paidAt ? o.paidAt.toISOString() : null,
      user: o.userEmail ? { name: o.userName, email: o.userEmail } : null,
      userDeleted: !o.userId,
      planName: o.planName,
      period: o.period,
      kind: o.kind,
      base: o.baseAmount,
      tax: o.taxAmount,
      total: o.totalAmount,
      taxRate: o.taxRate,
      currency: o.currency,
      startsAt: (o.termStartsAt ?? o.createdAt).toISOString(),
      expiresAt: (o.termEndsAt ?? o.createdAt).toISOString(),
      creditDays: o.creditDays,
      gateway: o.gateway,
      mode: o.mode,
      status: o.status,
      method: o.method,
      receipt: receiptOf(o),
      gatewayOrderId: o.gatewayOrderId,
      gatewayPaymentId: o.gatewayPaymentId,
      failureReason: o.failureReason,
    })),
  };
}

export async function resendReceiptAction(raw: unknown): Promise<Result> {
  await requireAdmin();
  const parsed = z.object({ orderId: z.string().uuid() }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  try {
    await sendReceipt(parsed.data.orderId);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg === SMTP_NOT_CONFIGURED ? "Email isn't set up yet (Settings → Email / SMTP)." : msg };
  }
}
