// How an order's GST divides between CGST + SGST (or UTGST) and IGST
// (docs/gst/spec.md G4, docs/invoices/spec.md section 12). Worked out once, when
// the order is created, and stored on it; the invoice prints what was stored.
//
// Place of supply is the buyer's state (CBIC Circular 242/36/2024-GST: the
// state recorded for an online service is the address on record). With no
// buyer state on record (orders from before billing details), it's the
// seller's own state (IGST Act section 12(2)(b)), so CGST + SGST.

import { stateByCode } from "@/lib/india-states";

export interface TaxSplit {
  cgst: number;
  /** SGST, or UTGST for a union territory without its own legislature. */
  sgst: number;
  igst: number;
  /** The buyer's state code, or the seller's when the buyer's isn't known. Null with GST off. */
  placeOfSupply: string | null;
  /** Same state: CGST + SGST/UTGST. Different: IGST. Null with GST off. */
  split: "intra" | "inter" | null;
  /** The state-level part is UTGST (seller in Chandigarh, Ladakh and the like). */
  utgst: boolean;
}

export const NO_SPLIT: TaxSplit = { cgst: 0, sgst: 0, igst: 0, placeOfSupply: null, split: null, utgst: false };

/** `tax` in paise. Rounding happens once: cgst is the lower half, sgst the rest, so they always add up. */
export function splitTax(tax: number, opts: { registered: boolean; sellerState: string | null; buyerState: string | null }): TaxSplit {
  if (!opts.registered || tax <= 0 || !opts.sellerState) return NO_SPLIT;
  const place = opts.buyerState || opts.sellerState;
  if (place === opts.sellerState) {
    const cgst = Math.floor(tax / 2);
    return { cgst, sgst: tax - cgst, igst: 0, placeOfSupply: place, split: "intra", utgst: !!stateByCode(opts.sellerState)?.utgst };
  }
  return { cgst: 0, sgst: 0, igst: tax, placeOfSupply: place, split: "inter", utgst: false };
}
