// Indian states and union territories with their GST state codes (the first
// two digits of a GSTIN). Used for billing addresses and to decide the tax
// split: same state as Jobtiva's registration → CGST + SGST (or UTGST for a
// union territory without its own legislature), another state → IGST
// (docs/gst/spec.md G4). The GST spec's admin States tab will make this
// editable; until then this list is the source.

export interface IndiaState {
  code: string;
  name: string;
  /** A union territory without its own legislature: UTGST instead of SGST. */
  utgst: boolean;
}

export const INDIA_STATES: IndiaState[] = [
  { code: "35", name: "Andaman and Nicobar Islands", utgst: true },
  { code: "37", name: "Andhra Pradesh", utgst: false },
  { code: "12", name: "Arunachal Pradesh", utgst: false },
  { code: "18", name: "Assam", utgst: false },
  { code: "10", name: "Bihar", utgst: false },
  { code: "04", name: "Chandigarh", utgst: true },
  { code: "22", name: "Chhattisgarh", utgst: false },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu", utgst: true },
  { code: "07", name: "Delhi", utgst: false },
  { code: "30", name: "Goa", utgst: false },
  { code: "24", name: "Gujarat", utgst: false },
  { code: "06", name: "Haryana", utgst: false },
  { code: "02", name: "Himachal Pradesh", utgst: false },
  { code: "01", name: "Jammu and Kashmir", utgst: false },
  { code: "20", name: "Jharkhand", utgst: false },
  { code: "29", name: "Karnataka", utgst: false },
  { code: "32", name: "Kerala", utgst: false },
  { code: "38", name: "Ladakh", utgst: true },
  { code: "31", name: "Lakshadweep", utgst: true },
  { code: "23", name: "Madhya Pradesh", utgst: false },
  { code: "27", name: "Maharashtra", utgst: false },
  { code: "14", name: "Manipur", utgst: false },
  { code: "17", name: "Meghalaya", utgst: false },
  { code: "15", name: "Mizoram", utgst: false },
  { code: "13", name: "Nagaland", utgst: false },
  { code: "21", name: "Odisha", utgst: false },
  { code: "34", name: "Puducherry", utgst: false },
  { code: "03", name: "Punjab", utgst: false },
  { code: "08", name: "Rajasthan", utgst: false },
  { code: "11", name: "Sikkim", utgst: false },
  { code: "33", name: "Tamil Nadu", utgst: false },
  { code: "36", name: "Telangana", utgst: false },
  { code: "16", name: "Tripura", utgst: false },
  { code: "09", name: "Uttar Pradesh", utgst: false },
  { code: "05", name: "Uttarakhand", utgst: false },
  { code: "19", name: "West Bengal", utgst: false },
];

export const stateByCode = (code: string | null | undefined): IndiaState | undefined =>
  INDIA_STATES.find((s) => s.code === code);
