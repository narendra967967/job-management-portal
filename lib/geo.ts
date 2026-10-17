// Location → country / market helpers. Pure (no server or browser APIs), so the
// leads filters (client) and the salary insight (server) share one source.
//
// LinkedIn and manual leads only give a free-text location ("Bengaluru,
// Karnataka, India", "London Area, United Kingdom (Hybrid)", "Remote (EU)"),
// so this is a transparent heuristic: a known country name first, then a US
// "City, ST" pattern, then common cities. Extend the maps as regions show up.

const COUNTRY_NAMES = [
  "United Arab Emirates",
  "United States",
  "United Kingdom",
  "Saudi Arabia",
  "New Zealand",
  "India",
  "Canada",
  "Australia",
  "Germany",
  "Ireland",
  "Singapore",
  "Netherlands",
  "France",
  "Spain",
  "Italy",
  "Portugal",
  "Poland",
  "Sweden",
  "Denmark",
  "Norway",
  "Finland",
  "Belgium",
  "Austria",
  "Switzerland",
  "Japan",
  "Malaysia",
  "Qatar",
  "Cyprus",
];

const CITY_COUNTRY: Record<string, string> = {
  london: "United Kingdom",
  manchester: "United Kingdom",
  edinburgh: "United Kingdom",
  slough: "United Kingdom",
  addlestone: "United Kingdom",
  bromsgrove: "United Kingdom",
  "newcastle upon tyne": "United Kingdom",
  england: "United Kingdom",
  scotland: "United Kingdom",
  wales: "United Kingdom",
  "northern ireland": "United Kingdom",
  birmingham: "United Kingdom",
  bristol: "United Kingdom",
  cambridge: "United Kingdom",
  oxford: "United Kingdom",
  reading: "United Kingdom",
  glasgow: "United Kingdom",
  cardiff: "United Kingdom",
  nottingham: "United Kingdom",
  sheffield: "United Kingdom",
  "milton keynes": "United Kingdom",
  leeds: "United Kingdom",
  liverpool: "United Kingdom",
  belfast: "United Kingdom",
  southampton: "United Kingdom",
  watford: "United Kingdom",
  warrington: "United Kingdom",
  telford: "United Kingdom",
  rickmansworth: "United Kingdom",
  marlow: "United Kingdom",
  kettering: "United Kingdom",
  "hemel hempstead": "United Kingdom",
  hampshire: "United Kingdom",
  dunstable: "United Kingdom",
  cheadle: "United Kingdom",
  ashford: "United Kingdom",
  newport: "United Kingdom",
  iver: "United Kingdom",
  dubai: "United Arab Emirates",
  "abu dhabi": "United Arab Emirates",
  "global village": "United Arab Emirates",
  riyadh: "Saudi Arabia",
  doha: "Qatar",
  gurgaon: "India",
  gurugram: "India",
  noida: "India",
  "new delhi": "India",
  delhi: "India",
  pune: "India",
  bengaluru: "India",
  bangalore: "India",
  mumbai: "India",
  hyderabad: "India",
  chennai: "India",
  kolkata: "India",
  ahmedabad: "India",
  amsterdam: "Netherlands",
  rotterdam: "Netherlands",
  berlin: "Germany",
  munich: "Germany",
  hamburg: "Germany",
  frankfurt: "Germany",
  paris: "France",
  madrid: "Spain",
  barcelona: "Spain",
  lisbon: "Portugal",
  milan: "Italy",
  dublin: "Ireland",
  stockholm: "Sweden",
  copenhagen: "Denmark",
  zurich: "Switzerland",
  warsaw: "Poland",
  toronto: "Canada",
  vancouver: "Canada",
  sydney: "Australia",
  melbourne: "Australia",
  tokyo: "Japan",
  "kuala lumpur": "Malaysia",
  "san francisco": "United States",
  "new york": "United States",
  seattle: "United States",
  austin: "United States",
  boston: "United States",
  chicago: "United States",
  columbus: "United States",
  madison: "United States",
};

/** Country for a free-text location, or "Other" when it can't be told. */
export function countryOf(location: string): string {
  const base = location
    .replace(/\s*\((?:remote|hybrid|on-?site)\)\s*$/i, "")
    .trim();
  const lower = base.toLowerCase();
  for (const c of COUNTRY_NAMES) {
    if (lower.includes(c.toLowerCase())) return c;
  }
  if (/,\s*[A-Z]{2}$/.test(base)) return "United States"; // "Chicago, IL"
  // Whole-word match, so a short name ("iver") can't hit inside another
  // ("liverpool", "riverside").
  for (const [city, country] of Object.entries(CITY_COUNTRY)) {
    if (new RegExp(`\\b${city}\\b`).test(lower)) return country;
  }
  return "Other";
}

const EURO = "EUR";
const CURRENCY_BY_COUNTRY: Record<string, string> = {
  India: "INR",
  "United States": "USD",
  "United Kingdom": "GBP",
  "United Arab Emirates": "AED",
  "Saudi Arabia": "SAR",
  Qatar: "QAR",
  Canada: "CAD",
  Australia: "AUD",
  "New Zealand": "NZD",
  Singapore: "SGD",
  Japan: "JPY",
  Malaysia: "MYR",
  Switzerland: "CHF",
  Sweden: "SEK",
  Denmark: "DKK",
  Norway: "NOK",
  Poland: "PLN",
  Germany: EURO,
  Ireland: EURO,
  Netherlands: EURO,
  France: EURO,
  Spain: EURO,
  Italy: EURO,
  Portugal: EURO,
  Finland: EURO,
  Belgium: EURO,
  Austria: EURO,
  Cyprus: EURO,
};

// Region words used in remote listings ("Remote (EU)", "EMEA", "Remote – US").
const REGIONS: { pattern: RegExp; market: string; currency: string }[] = [
  { pattern: /\b(eu|europe|european union|eea|emea)\b/i, market: "Europe (EU)", currency: EURO },
  { pattern: /\b(uk|u\.k\.|great britain)\b/i, market: "United Kingdom", currency: "GBP" },
  { pattern: /\b(us|usa|u\.s\.a?\.?|north america)\b/i, market: "United States", currency: "USD" },
  { pattern: /\b(gcc|middle east)\b/i, market: "Middle East (GCC)", currency: "AED" },
];

export interface SalaryMarket {
  /** Human label, e.g. "India", "Europe (EU)". */
  market: string;
  /** ISO 4217 code. */
  currency: string;
}

/**
 * The pay market + currency for a job, decided by the app (not the AI) from its
 * location: a country (or city) first, then a region word. Null when the
 * location says nothing usable (e.g. just "Remote") — the caller decides the
 * fallback.
 */
export function salaryMarketFor(location: string): SalaryMarket | null {
  const country = countryOf(location);
  if (country !== "Other" && CURRENCY_BY_COUNTRY[country]) {
    return { market: country, currency: CURRENCY_BY_COUNTRY[country] };
  }
  for (const r of REGIONS) {
    if (r.pattern.test(location)) return { market: r.market, currency: r.currency };
  }
  return null;
}

/** Countries the profile "Country" picker offers (every one has a known currency). */
export const COUNTRY_OPTIONS: string[] = Object.keys(CURRENCY_BY_COUNTRY).sort((a, b) =>
  a.localeCompare(b),
);

/** Currency for a country name from COUNTRY_OPTIONS (null if unknown). */
export function currencyForCountry(country: string): string | null {
  return CURRENCY_BY_COUNTRY[country] ?? null;
}

// Mobile dial code → country. Only India is selectable in the mobile field
// today (lib/validation.ts), but the others resolve as soon as they're enabled.
const DIAL_COUNTRY: Record<string, string> = {
  "+91": "India",
  "+1": "United States",
  "+44": "United Kingdom",
  "+971": "United Arab Emirates",
  "+966": "Saudi Arabia",
  "+974": "Qatar",
  "+65": "Singapore",
  "+61": "Australia",
  "+64": "New Zealand",
  "+81": "Japan",
  "+60": "Malaysia",
  "+49": "Germany",
  "+353": "Ireland",
  "+31": "Netherlands",
  "+33": "France",
  "+34": "Spain",
  "+39": "Italy",
  "+351": "Portugal",
  "+48": "Poland",
  "+46": "Sweden",
  "+45": "Denmark",
  "+47": "Norway",
  "+358": "Finland",
  "+32": "Belgium",
  "+43": "Austria",
  "+41": "Switzerland",
  "+357": "Cyprus",
};

/** Country for a stored mobile number ("+91 9876543210"), or null. */
export function countryForMobile(mobile: string | null | undefined): string | null {
  const m = (mobile ?? "").trim().match(/^\+(\d{1,4})/);
  if (!m) return null;
  // Longest matching code wins ("+971" before "+9…").
  for (let len = Math.min(4, m[1].length); len >= 1; len--) {
    const hit = DIAL_COUNTRY[`+${m[1].slice(0, len)}`];
    if (hit) return hit;
  }
  return null;
}

/** Where the salary market came from (shown to the user). */
export type MarketSource = "location" | "profile" | "mobile" | "default";

/**
 * The pay market for a job, always resolved by the app (never left to the AI):
 *  1. the job's own location ("Remote (EU)" → Europe / EUR);
 *  2. else the user's profile country;
 *  3. else the country of their mobile number's dial code;
 *  4. else India (the app's home market).
 */
export function resolveSalaryMarket(input: {
  location: string;
  profileCountry: string | null | undefined;
  mobile: string | null | undefined;
}): SalaryMarket & { source: MarketSource } {
  const fromLocation = salaryMarketFor(input.location);
  if (fromLocation) return { ...fromLocation, source: "location" };
  const profile = input.profileCountry?.trim();
  if (profile && currencyForCountry(profile)) {
    return { market: profile, currency: currencyForCountry(profile)!, source: "profile" };
  }
  const fromMobile = countryForMobile(input.mobile);
  if (fromMobile && currencyForCountry(fromMobile)) {
    return { market: fromMobile, currency: currencyForCountry(fromMobile)!, source: "mobile" };
  }
  return { market: "India", currency: "INR", source: "default" };
}
