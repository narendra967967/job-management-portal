// Invoices (docs/invoices/spec.md). An InvoiceDoc is everything printed on one
// invoice, copied at the moment of payment and never changed afterwards (I3):
// the PDF is always drawn from this and nothing else. Amounts are in paise.

/** Bump when the layout changes; each invoice keeps the version that drew it. */
export const INVOICE_TEMPLATE_VERSION = 1;

export interface StateRef {
  name: string;
  /** GST state code, "06" for Haryana. */
  code: string;
}

export interface InvoiceSeller {
  /** Business name as it should appear, e.g. "Jobtiva". */
  name: string;
  addressLines: string[];
  state: StateRef | null;
  pan: string | null;
  gstin: string | null;
  email: string;
  website: string;
}

export interface InvoiceBuyer {
  name: string;
  /** For a business (B2B) invoice: the registered business name. */
  businessName: string | null;
  addressLines: string[];
  state: StateRef;
  pin: string;
  email: string;
  mobile: string;
  gstin: string | null;
  pan: string | null;
}

export interface InvoiceLine {
  description: string;
  /** Second line, e.g. the plan's term dates. */
  detail: string | null;
  sac: string | null;
  quantity: number;
  /** Taxable value of the line (equals the amount when GST is off). */
  taxable: number;
}

export interface InvoiceDoc {
  templateVersion: number;
  number: string;
  /** ISO time the invoice was issued (the payment's confirmation). */
  issuedAt: string;
  currency: "INR";
  appName: string;
  /** PNG or JPEG data URI of the logo as it was at payment, or null for the name only. */
  logo: string | null;
  seller: InvoiceSeller;
  buyer: InvoiceBuyer;
  gst: {
    registered: boolean;
    /** Percent, e.g. 18. 0 when not registered. */
    rate: number;
    /** Buyer's state; printed only on a tax invoice. */
    placeOfSupply: StateRef | null;
    /** Same state as the seller: CGST + SGST. Different: IGST. */
    split: "intra" | "inter" | null;
  };
  lines: InvoiceLine[];
  totals: { taxable: number; cgst: number; sgst: number; igst: number; total: number };
  payment: { paidAt: string; method: string | null; paymentId: string; orderNumber: string; gateway: string };
  /** Up to 5 short terms printed under the invoice, as they were at payment. */
  terms: string[];
  links: { terms: string; privacy: string; refunds: string };
  /** The exact declaration line(s) printed, as decided at payment. */
  declarations: string[];
}

export const invoiceTitle = (d: InvoiceDoc) => (d.gst.registered ? "Tax Invoice" : "Invoice");

/**
 * The terms printed under every invoice until admin can edit them (phase 3).
 * Taken from the Terms and the Refund & cancellation policy as they stand on
 * November 18, 2026; each invoice keeps its own copy, so editing these later
 * never changes an invoice already issued.
 */
export const DEFAULT_INVOICE_TERMS: string[] = [
  "Plans don't renew automatically. Your plan runs for the period shown above and then ends. You're never charged again unless you choose to renew.",
  "A plan can't be refunded once it has started, including if you stop partway through. If you upgrade, the unused part of your old plan carries over as extra days, not as a refund.",
  "If a payment goes wrong, we put it right: a double charge, a payment that went through without your plan changing, or an amount different from the one shown is refunded in full once we've checked our records. Banks usually show a refund within 5 to 7 working days.",
  "Payments are handled by Razorpay. We never see or store your card, UPI or bank details.",
  "For anything about this payment, email us or use Help & support in the app, and quote the invoice number. The full rules are in the policies linked at the bottom of this page.",
];

/** What's printed under the totals, decided at payment. Wording to be confirmed by the CA. */
export function defaultDeclarations(registered: boolean, sellerName: string): string[] {
  return registered
    ? ["Tax payable on reverse charge: No."]
    : [`${sellerName} is not registered under GST, so no GST has been charged on this invoice.`];
}

/** 49900 → "499.00", 12345600 → "1,23,456.00" (Indian grouping). */
export function formatPaise(paise: number): string {
  return (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "November 18, 2026", in India time (invoices are dated in IST). */
export function invoiceDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Kolkata" });
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? belowHundred(r) : ""].filter(Boolean).join(" ");
}

/** Whole rupees in the Indian system: crore, lakh, thousand. */
function rupeesInWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(`${rupeesInWords(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(" ");
}

/** 58940 → "Rupees Five Hundred Eighty-Nine and Forty Paise Only". */
export function amountInWords(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const p = paise % 100;
  return `Rupees ${rupeesInWords(rupees)}${p ? ` and ${belowHundred(p)} Paise` : ""} Only`;
}
