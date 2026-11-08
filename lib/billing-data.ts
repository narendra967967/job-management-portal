import "server-only";

// Reads admin Billing (seller + tax details) as a BillingProfile. Shared by
// checkout (is online payment allowed? what tax?) and admin Settings.

import { db } from "@/lib/db";
import { billingConfig } from "@/db/schema";
import type { BillingProfile } from "@/lib/billing-model";

export async function getBillingProfile(): Promise<BillingProfile> {
  const [b] = await db.select().from(billingConfig).limit(1);
  return {
    gstRegistered: b?.gstRegistered ?? null,
    companyName: b?.companyName ?? "",
    companyAddress: b?.companyAddress ?? "",
    pan: b?.pan ?? "",
    gstin: b?.gstin ?? "",
    taxRate: b?.taxRate ?? 18,
    pricesIncludeTax: b?.pricesIncludeTax ?? false,
    sacCode: b?.sacCode ?? "",
    invoicePrefix: b?.invoicePrefix ?? "JOB-",
  };
}
