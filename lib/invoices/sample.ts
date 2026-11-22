// Sample invoices for designing the layout (docs/invoices/spec.md, phase 1).
// Every business and personal detail here is made up: the PAN, GSTINs,
// addresses, people and payment IDs are placeholders, not real records.

import { DEFAULT_AI_INTERVIEW_TERMS, DEFAULT_INVOICE_TERMS, INVOICE_TEMPLATE_VERSION, defaultDeclarations, type InvoiceDoc, type InvoiceSeller } from "@/lib/invoices/model";

const HARYANA = { name: "Haryana", code: "06" };
const MAHARASHTRA = { name: "Maharashtra", code: "27" };
const KARNATAKA = { name: "Karnataka", code: "29" };

const links = { terms: "https://jobtiva.in/terms", privacy: "https://jobtiva.in/privacy", refunds: "https://jobtiva.in/refunds" };

const seller = (registered: boolean): InvoiceSeller => ({
  name: "Jobtiva",
  addressLines: ["Sample Street, Sector 00", "Gurugram"],
  state: HARYANA,
  pan: "ABCDE1234F",
  gstin: registered ? "06ABCDE1234F1Z5" : null,
  email: "support@jobtiva.in",
  website: "https://jobtiva.in",
});

/** GST off: a plain Invoice for a monthly plan. */
export function sampleInvoiceGstOff(logo: string | null): InvoiceDoc {
  return {
    templateVersion: INVOICE_TEMPLATE_VERSION,
    number: "JT/26-27/00001",
    issuedAt: "2026-11-18T06:42:00Z",
    currency: "INR",
    appName: "Jobtiva",
    logo,
    seller: seller(false),
    buyer: {
      name: "Priya Sharma",
      businessName: null,
      addressLines: ["Flat 12, Sample Apartments, Baner Road", "Pune"],
      state: MAHARASHTRA,
      pin: "411045",
      email: "priya.sharma@example.com",
      mobile: "98765 43210",
      gstin: null,
      pan: null,
    },
    gst: { registered: false, rate: 0, placeOfSupply: null, split: null },
    lines: [
      { description: "Pro plan, monthly", detail: "November 18, 2026 to December 17, 2026", sac: null, quantity: 1, taxable: 49900 },
    ],
    totals: { taxable: 49900, cgst: 0, sgst: 0, igst: 0, total: 49900 },
    payment: { paidAt: "2026-11-18T06:42:00Z", method: "UPI", paymentId: "pay_SAMPLE0000000001", orderNumber: "JT-001207", gateway: "Razorpay" },
    terms: DEFAULT_INVOICE_TERMS,
    links,
    declarations: defaultDeclarations(false, "Jobtiva"),
  };
}

/** GST on, buyer in the same state: Tax Invoice with CGST + SGST, prices include GST. */
export function sampleInvoiceGstIntra(logo: string | null): InvoiceDoc {
  // ₹4,999 including 18%: taxable 4,236.44, tax 762.56 split in half.
  return {
    ...sampleInvoiceGstOff(logo),
    number: "JT/26-27/00002",
    seller: seller(true),
    buyer: {
      name: "Rahul Verma",
      businessName: null,
      addressLines: ["House 45, Sample Colony", "Gurugram"],
      state: HARYANA,
      pin: "122001",
      email: "rahul.verma@example.com",
      mobile: "91234 56780",
      gstin: null,
      pan: null,
    },
    gst: { registered: true, rate: 18, placeOfSupply: HARYANA, split: "intra" },
    lines: [
      { description: "Pro plan, yearly", detail: "November 18, 2026 to November 17, 2027", sac: "998314", quantity: 1, taxable: 423644 },
    ],
    totals: { taxable: 423644, cgst: 38128, sgst: 38128, igst: 0, total: 499900 },
    payment: { paidAt: "2026-11-18T06:42:00Z", method: "Card", paymentId: "pay_SAMPLE0000000002", orderNumber: "JT-001208", gateway: "Razorpay" },
    declarations: defaultDeclarations(true, "Jobtiva"),
  };
}

/** GST on, business buyer in another state: Tax Invoice with IGST, for an AI mock interview. */
export function sampleInvoiceGstInterB2b(logo: string | null): InvoiceDoc {
  // ₹590 including 18%: taxable 500.00, IGST 90.00.
  return {
    ...sampleInvoiceGstIntra(logo),
    number: "JT/26-27/00003",
    buyer: {
      name: "Anita Rao",
      businessName: "Sample Talent Pvt Ltd",
      addressLines: ["2nd Floor, Sample Tech Park, Outer Ring Road", "Bengaluru"],
      state: KARNATAKA,
      pin: "560103",
      email: "anita.rao@example.com",
      mobile: "99000 11223",
      gstin: "29AAACS1234A1Z5",
      pan: null,
    },
    gst: { registered: true, rate: 18, placeOfSupply: KARNATAKA, split: "inter" },
    lines: [{ description: "AI mock interview: 30 min, Medium", detail: "Start it by December 18, 2026", sac: "998314", quantity: 1, taxable: 50000 }],
    totals: { taxable: 50000, cgst: 0, sgst: 0, igst: 9000, total: 59000 },
    payment: { paidAt: "2026-11-18T06:42:00Z", method: "Netbanking", paymentId: "pay_SAMPLE0000000003", orderNumber: "JT-001209", gateway: "Razorpay" },
    terms: DEFAULT_AI_INTERVIEW_TERMS,
  };
}
