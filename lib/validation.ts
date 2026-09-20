// Shared, dependency-free validation helpers used by the Settings inputs
// (client) and their Server Actions (server), so both sides enforce the same
// rules. Kept pure — no React, no DB — so it imports cleanly on either side.
//
// (The TRD calls for Zod on Server Action inputs; Zod isn't a dependency in
// this repo yet, so these hand-rolled checks stand in until it's added.)

export interface CountryCode {
  iso: string;
  dial: string; // e.g. "+91"
  label: string; // e.g. "India (+91)"
  flag: string; // emoji
  example: string; // sample national number for placeholders/errors
  /** Is this a valid national number (digits only, no dial code)? */
  test: (national: string) => boolean;
}

// Only India for now (owner request). To support more countries, add entries
// here — the mobile field, its parser and validation all read from this list.
export const COUNTRY_CODES: CountryCode[] = [
  {
    iso: "IN",
    dial: "+91",
    label: "India (+91)",
    flag: "🇮🇳",
    example: "98765 43210",
    test: (n) => /^[6-9]\d{9}$/.test(n),
  },
];

export const DEFAULT_COUNTRY = COUNTRY_CODES[0];

export function findCountryByDial(dial: string): CountryCode | undefined {
  return COUNTRY_CODES.find((c) => c.dial === dial);
}

/** Split a stored "+91 9876543210" into its dial code + national digits. */
export function splitMobile(raw: string): { dial: string; national: string } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { dial: DEFAULT_COUNTRY.dial, national: "" };
  // Longest dial first so "+91" wins over a shorter prefix.
  const match = [...COUNTRY_CODES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((c) => trimmed.startsWith(c.dial));
  if (match) {
    return { dial: match.dial, national: trimmed.slice(match.dial.length).replace(/\D/g, "") };
  }
  // Legacy/unknown value (e.g. a seeded "+1 …"): keep the digits so the user
  // can see and correct them; default the code to the only supported country.
  return { dial: DEFAULT_COUNTRY.dial, national: trimmed.replace(/\D/g, "") };
}

/** Combine a dial code + national digits into the stored form; empty → "". */
export function joinMobile(dial: string, national: string): string {
  const digits = national.replace(/\D/g, "");
  return digits ? `${dial} ${digits}` : "";
}

/**
 * Validate a mobile number. The field is optional, so an empty national number
 * is valid; a non-empty one must match its country's rules. Returns an error
 * message, or null when valid.
 */
export function validateMobile(dial: string, national: string): string | null {
  const digits = national.replace(/\D/g, "");
  if (!digits) return null; // optional
  const country = findCountryByDial(dial) ?? DEFAULT_COUNTRY;
  if (!country.test(digits)) {
    return `Enter a valid ${country.label} mobile number (e.g. ${country.example}).`;
  }
  return null;
}

// Pragmatic email check — good enough for a contact field, not RFC-perfect.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim());
}
