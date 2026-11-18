// A buyer's billing details (docs/invoices/spec.md, section 2): required before
// any payment, GST on or off. These checks are shared by the form and, in
// phase 3, the server, so both refuse exactly the same things.

import { isValidGstin, isValidPan } from "@/lib/billing-model";
import { stateByCode } from "@/lib/india-states";
import { validateMobile } from "@/lib/validation";

export interface BillingDetails {
  fullName: string;
  /** 10-digit Indian mobile, digits only. */
  mobile: string;
  addressLine: string;
  city: string;
  /** GST state code, e.g. "06". */
  stateCode: string;
  pin: string;
  /** Only India for now (GST spec G8). */
  country: "IN";
  /** Optional: makes it a business (B2B) invoice. */
  gstin: string;
  /** Required when a GSTIN is given: the registered business name. */
  businessName: string;
  /** Optional. */
  pan: string;
}

export const EMPTY_BILLING: BillingDetails = {
  fullName: "",
  mobile: "",
  addressLine: "",
  city: "",
  stateCode: "",
  pin: "",
  country: "IN",
  gstin: "",
  businessName: "",
  pan: "",
};

export type BillingErrors = Partial<Record<keyof BillingDetails, string>>;

/** Field-by-field problems; an empty object means the details are complete and valid. */
export function billingErrors(b: BillingDetails): BillingErrors {
  const e: BillingErrors = {};
  const name = b.fullName.trim();
  if (!name) e.fullName = "Enter the name to show on invoices.";
  else if (name.length > 100) e.fullName = "Keep the name under 100 characters.";

  const mobileError = validateMobile("+91", b.mobile.replace(/\s+/g, ""));
  if (!b.mobile.trim()) e.mobile = "Enter your mobile number.";
  else if (mobileError) e.mobile = mobileError;

  if (!b.addressLine.trim()) e.addressLine = "Enter your address.";
  else if (b.addressLine.trim().length > 200) e.addressLine = "Keep the address under 200 characters.";
  if (!b.city.trim()) e.city = "Enter your city.";
  if (!stateByCode(b.stateCode)) e.stateCode = "Choose your state.";
  if (!/^[1-9][0-9]{5}$/.test(b.pin.trim())) e.pin = "Enter your 6-digit PIN code.";

  const gstin = b.gstin.trim().toUpperCase();
  if (gstin) {
    if (!isValidGstin(gstin)) e.gstin = "That GSTIN isn't valid. Check all 15 characters.";
    else if (b.stateCode && gstin.slice(0, 2) !== b.stateCode) e.gstin = "This GSTIN is registered in another state. Choose that state, or check the GSTIN.";
    if (!b.businessName.trim()) e.businessName = "Enter the business name registered with this GSTIN.";
  }
  if (b.pan.trim() && !isValidPan(b.pan)) e.pan = "That PAN isn't valid. It's 5 letters, 4 digits, 1 letter.";
  return e;
}

export const isBillingComplete = (b: BillingDetails | null): b is BillingDetails => !!b && Object.keys(billingErrors(b)).length === 0;

/** "Gurugram, Haryana 122001" */
export function billingPlace(b: BillingDetails): string {
  return `${b.city.trim()}, ${stateByCode(b.stateCode)?.name ?? ""} ${b.pin.trim()}`.trim();
}

/** Sample details for the phase 1 screens (made up). */
export const SAMPLE_BILLING: BillingDetails = {
  fullName: "Priya Sharma",
  mobile: "9876543210",
  addressLine: "Flat 12, Sample Apartments, Baner Road",
  city: "Pune",
  stateCode: "27",
  pin: "411045",
  country: "IN",
  gstin: "",
  businessName: "",
  pan: "",
};
