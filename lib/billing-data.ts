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

export interface PublicBusiness {
  name: string;
  /** Address lines as entered in Billing. */
  addressLines: string[];
}

/** The business name and address from admin Billing, for public contact
 *  details (homepage Contact, and the Contact sections of the legal pages).
 *  Null until Billing has both. Owner rule: anywhere we give contact details
 *  publicly, show the support email AND this. */
export async function getPublicBusiness(): Promise<PublicBusiness | null> {
  try {
    const [b] = await db
      .select({ name: billingConfig.companyName, address: billingConfig.companyAddress })
      .from(billingConfig)
      .limit(1);
    const name = b?.name?.trim() ?? "";
    const addressLines = (b?.address ?? "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    return name && addressLines.length ? { name, addressLines } : null;
  } catch {
    return null; // DB unavailable (e.g. during a build)
  }
}
