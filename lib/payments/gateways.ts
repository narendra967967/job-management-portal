import "server-only";

// Payment gateway config (admin Settings → Payments), stored in
// payment_gateways with the secrets encrypted (lib/crypto). Secrets are only
// decrypted here, on the server, to call the gateway; the admin screen only
// ever learns whether each one is set.

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { paymentGateways } from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";
import type { GatewayId, GatewaySettings } from "@/lib/billing-model";
import type { RazorpayCreds } from "@/lib/payments/razorpay";

export const GATEWAY_IDS: GatewayId[] = ["razorpay"];

type Row = typeof paymentGateways.$inferSelect;

function toSettings(id: GatewayId, r: Row | undefined): GatewaySettings {
  return {
    id,
    enabled: r?.enabled ?? false,
    mode: r?.mode ?? "test",
    keyId: r?.keyId ?? "",
    hasKeySecret: !!r?.keySecretCiphertext,
    hasWebhookSecret: !!r?.webhookSecretCiphertext,
    lastTestOk: r?.lastTestOk ?? null,
    lastTestAt: r?.lastTestAt ? r.lastTestAt.toISOString() : null,
  };
}

export async function getGatewayRow(id: GatewayId): Promise<Row | undefined> {
  const [r] = await db.select().from(paymentGateways).where(eq(paymentGateways.id, id));
  return r;
}

/** Admin view of every gateway (no secrets). */
export async function listGatewaySettings(): Promise<GatewaySettings[]> {
  const rows = await db.select().from(paymentGateways);
  return GATEWAY_IDS.map((id) => toSettings(id, rows.find((r) => r.id === id)));
}

/** All three credentials saved (needed before a gateway can be switched on). */
export function gatewayComplete(r: Row | undefined): boolean {
  return !!(r?.keyId && r.keySecretCiphertext && r.webhookSecretCiphertext);
}

export function credsOf(r: Row): RazorpayCreds | null {
  if (!r.keyId || !r.keySecretCiphertext) return null;
  try {
    return { keyId: r.keyId, keySecret: decryptSecret(r.keySecretCiphertext) };
  } catch {
    return null; // APP_ENCRYPTION_KEY changed: the admin re-enters the secret
  }
}

export function webhookSecretOf(r: Row): string | null {
  if (!r.webhookSecretCiphertext) return null;
  try {
    return decryptSecret(r.webhookSecretCiphertext);
  } catch {
    return null;
  }
}

/** The gateway checkout uses: switched on with complete credentials, or null
 *  (then users get the "request through support" flow). */
export async function activeGateway(): Promise<{ id: GatewayId; row: Row; creds: RazorpayCreds } | null> {
  const r = await getGatewayRow("razorpay");
  if (!r?.enabled || !gatewayComplete(r)) return null;
  const creds = credsOf(r);
  return creds ? { id: "razorpay", row: r, creds } : null;
}
