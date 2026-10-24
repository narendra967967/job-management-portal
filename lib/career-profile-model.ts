// Career profile — shared model (client + server): the shape, the fixed option
// lists, input limits, Zod schemas per section, and the completion rule.
//
// The career profile is what the user tells us about their career and job
// preferences. It feeds the AI features (résumé ATS check, fit score, drafts)
// only — nothing ever applies to jobs automatically.

import { z } from "zod";

/* ---------------- option lists ---------------- */

export const SENIORITY_OPTIONS = [
  ["intern", "Intern"],
  ["entry", "Entry level"],
  ["associate", "Associate"],
  ["mid", "Mid-level"],
  ["senior", "Senior"],
  ["lead", "Lead / Principal"],
  ["manager", "Manager"],
  ["director", "Director"],
  ["vp", "VP"],
  ["executive", "C-level / Executive"],
] as const;

export const WORK_MODE_OPTIONS = [
  ["remote", "Remote"],
  ["hybrid", "Hybrid"],
  ["onsite", "On-site"],
] as const;

export const EMPLOYMENT_TYPE_OPTIONS = [
  ["full_time", "Full-time"],
  ["part_time", "Part-time"],
  ["contract", "Contract"],
  ["freelance", "Freelance"],
  ["internship", "Internship"],
] as const;

export const NOTICE_PERIOD_OPTIONS = [
  ["immediate", "Immediate"],
  ["15", "15 days"],
  ["30", "30 days"],
  ["45", "45 days"],
  ["60", "60 days"],
  ["90", "90 days"],
  ["90_plus", "More than 90 days"],
  ["serving", "Serving notice"],
] as const;

export const PAY_PERIOD_OPTIONS = [
  ["year", "per year"],
  ["month", "per month"],
] as const;

export const CURRENCY_OPTIONS = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "CAD", "AUD"] as const;
export type Currency = (typeof CURRENCY_OPTIONS)[number];

export const GENDER_OPTIONS = [
  ["female", "Female"],
  ["male", "Male"],
  ["non_binary", "Non-binary"],
  ["prefer_not", "Prefer not to say"],
] as const;

export const YES_NO_PREFER_OPTIONS = [
  ["yes", "Yes"],
  ["no", "No"],
  ["prefer_not", "Prefer not to say"],
] as const;

/** Suggestions shown under chip inputs (the user can type anything). */
export const ROLE_SUGGESTIONS = [
  "Project Manager",
  "Program Manager",
  "Technical Program Manager",
  "Product Manager",
  "Delivery Manager",
  "Scrum Master",
  "Engineering Manager",
  "Business Analyst",
  "Software Engineer",
  "Data Analyst",
];
export const LANGUAGE_SUGGESTIONS = [
  "English",
  "Hindi",
  "Bengali",
  "Marathi",
  "Telugu",
  "Tamil",
  "Gujarati",
  "Kannada",
  "Malayalam",
  "Punjabi",
  "French",
  "German",
  "Spanish",
  "Arabic",
];
export const INDUSTRY_SUGGESTIONS = [
  "SaaS",
  "IT services",
  "FinTech",
  "E-commerce",
  "Healthcare",
  "EdTech",
  "BFSI",
  "Logistics",
  "Manufacturing",
  "Telecom",
  "Consulting",
];
export const SKILL_SUGGESTIONS = [
  "Stakeholder management",
  "Agile",
  "Scrum",
  "Risk management",
  "Roadmapping",
  "Budgeting",
  "Requirements gathering",
  "Team leadership",
];
export const TOOL_SUGGESTIONS = ["Jira", "Confluence", "Excel", "Power BI", "SQL", "Figma", "MS Project", "Notion"];

/* ---------------- limits ---------------- */

export const LIMITS = {
  text: 120,
  url: 300,
  summary: 5000,
  description: 4000,
  chip: 60,
  skills: 30,
  tools: 30,
  languages: 6,
  countries: 20,
  roles: 10,
  locations: 10,
  industries: 10,
  experiences: 20,
  educations: 10,
  certifications: 20,
} as const;

/** The summary length the ATS check wants (plain characters). */
export const SUMMARY_MIN = 200;
/** Recruiter tip shown under the summary counter. */
export const SUMMARY_TIP = 500;
export const MIN_SKILLS = 3;

const CURRENT_YEAR = new Date().getFullYear();
export const YEAR_MIN = 1960;
export const YEAR_MAX = CURRENT_YEAR + 6; // expected graduation years

/* ---------------- shape ---------------- */

export interface Pay {
  amount: number;
  currency: Currency;
  period: "year" | "month";
}

export interface WorkExperience {
  title: string;
  company: string;
  location: string;
  employmentType: string;
  startMonth: number | null;
  startYear: number | null;
  endMonth: number | null;
  endYear: number | null;
  isCurrent: boolean;
  /** Achievements, one "- " bullet per line (Markdown). */
  description: string;
}

export interface Education {
  degree: string;
  field: string;
  institution: string;
  startYear: number | null;
  endYear: number | null;
  grade: string;
}

export interface Certification {
  name: string;
  issuer: string;
  year: number | null;
  url: string;
}

export interface CareerProfile {
  // Basic info (name, email, phone and country live on the user's Profile)
  currentTitle: string;
  city: string;
  yearsExperience: number | null;
  linkedinUrl: string;
  portfolioUrl: string;
  // Summary
  summary: string;
  // Skills
  skills: string[];
  tools: string[];
  // Work eligibility
  languages: string[];
  workCountries: string[];
  needsSponsorship: boolean | null;
  sponsorshipCountries: string[];
  // Job preferences
  targetRoles: string[];
  seniority: string;
  workModes: string[];
  preferredLocations: string[];
  employmentTypes: string[];
  industries: string[];
  openToRelocate: boolean | null;
  noticePeriod: string;
  currentPay: Pay | null;
  expectedPay: Pay | null;
  // Optional questions
  gender: string;
  disability: string;
  veteran: string;
  // Repeatable
  experiences: WorkExperience[];
  educations: Education[];
  certifications: Certification[];
}

export const EMPTY_PROFILE: CareerProfile = {
  currentTitle: "",
  city: "",
  yearsExperience: null,
  linkedinUrl: "",
  portfolioUrl: "",
  summary: "",
  skills: [],
  tools: [],
  languages: [],
  workCountries: [],
  needsSponsorship: null,
  sponsorshipCountries: [],
  targetRoles: [],
  seniority: "",
  workModes: [],
  preferredLocations: [],
  employmentTypes: [],
  industries: [],
  openToRelocate: null,
  noticePeriod: "",
  currentPay: null,
  expectedPay: null,
  gender: "",
  disability: "",
  veteran: "",
  experiences: [],
  educations: [],
  certifications: [],
};

export const EMPTY_EXPERIENCE: WorkExperience = {
  title: "",
  company: "",
  location: "",
  employmentType: "",
  startMonth: null,
  startYear: null,
  endMonth: null,
  endYear: null,
  isCurrent: false,
  description: "",
};
export const EMPTY_EDUCATION: Education = {
  degree: "",
  field: "",
  institution: "",
  startYear: null,
  endYear: null,
  grade: "",
};
export const EMPTY_CERTIFICATION: Certification = { name: "", issuer: "", year: null, url: "" };

/* ---------------- completion ---------------- */

/** Markdown → rough plain text, for counting summary characters. */
export function plainLength(md: string): number {
  return md
    .replace(/[*_`#>\[\]()-]/g, "")
    .replace(/\s+/g, " ")
    .trim().length;
}

export interface CompletionItem {
  key: "title" | "years" | "skills" | "roles" | "summary" | "experience";
  label: string;
  /** Section anchor on the Career profile tab. */
  section: SectionKey;
  done: boolean;
}

/** The fields the résumé ATS check needs. All done = profile complete. */
export function careerCompletion(p: CareerProfile): { items: CompletionItem[]; percent: number; complete: boolean } {
  const items: CompletionItem[] = [
    { key: "title", label: "Current or last job title", section: "basics", done: !!p.currentTitle.trim() },
    { key: "years", label: "Years of experience", section: "basics", done: p.yearsExperience != null },
    { key: "summary", label: `Summary of ${SUMMARY_MIN}+ characters`, section: "summary", done: plainLength(p.summary) >= SUMMARY_MIN },
    { key: "skills", label: `At least ${MIN_SKILLS} skills`, section: "skills", done: p.skills.length >= MIN_SKILLS },
    { key: "experience", label: "At least 1 work experience", section: "experience", done: p.experiences.length > 0 },
    { key: "roles", label: "At least 1 target role", section: "preferences", done: p.targetRoles.length > 0 },
  ];
  const done = items.filter((i) => i.done).length;
  return { items, percent: Math.round((done / items.length) * 100), complete: done === items.length };
}

/* ---------------- sections + Zod (server re-validates everything) ---------------- */

export type SectionKey =
  | "basics"
  | "summary"
  | "skills"
  | "experience"
  | "education"
  | "certifications"
  | "eligibility"
  | "preferences"
  | "optional";

const text = (max: number = LIMITS.text) => z.string().trim().max(max, `Keep it under ${max} characters.`);
const chips = (max: number, what: string) =>
  z
    .array(z.string().trim().min(1).max(LIMITS.chip, `Each ${what} must be under ${LIMITS.chip} characters.`))
    .max(max, `Up to ${max} ${what}s.`)
    .transform((a) => [...new Map(a.map((v) => [v.toLowerCase(), v])).values()]);
const optionOf = <T extends readonly (readonly [string, string])[]>(opts: T) =>
  z.enum(["", ...opts.map((o) => o[0])] as [string, ...string[]]);
const multiOf = <T extends readonly (readonly [string, string])[]>(opts: T) =>
  z.array(z.enum(opts.map((o) => o[0]) as [string, ...string[]])).max(opts.length);
const url = z
  .string()
  .trim()
  .max(LIMITS.url)
  .refine((v) => v === "" || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v), "Enter a full link starting with https://");
const linkedin = url.refine(
  (v) => v === "" || /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\//i.test(v),
  "Enter a linkedin.com link.",
);
const month = z.number().int().min(1).max(12).nullable();
const year = z.number().int().min(YEAR_MIN).max(YEAR_MAX).nullable();
const pay = z
  .object({
    amount: z.number().int().min(0).max(1_000_000_000),
    currency: z.enum(CURRENCY_OPTIONS),
    period: z.enum(["year", "month"]),
  })
  .nullable();

const ym = (y: number | null, m: number | null) => (y ?? 0) * 12 + (m ?? 1);

export const experienceSchema = z
  .object({
    title: text().min(1, "Add the job title."),
    company: text().min(1, "Add the company."),
    location: text(),
    employmentType: optionOf(EMPLOYMENT_TYPE_OPTIONS),
    startMonth: month,
    startYear: year.refine((v) => v != null, "Add the start year."),
    endMonth: month,
    endYear: year,
    isCurrent: z.boolean(),
    description: text(LIMITS.description),
  })
  .refine((e) => e.isCurrent || e.endYear != null, { message: "Add the end year, or tick “I currently work here”.", path: ["endYear"] })
  .refine((e) => e.isCurrent || ym(e.endYear, e.endMonth) >= ym(e.startYear, e.startMonth), {
    message: "The end date is before the start date.",
    path: ["endYear"],
  });

export const educationSchema = z
  .object({
    degree: text().min(1, "Add the degree."),
    field: text(),
    institution: text().min(1, "Add the institution."),
    startYear: year,
    endYear: year,
    grade: text(40),
  })
  .refine((e) => e.startYear == null || e.endYear == null || e.endYear >= e.startYear, {
    message: "The end year is before the start year.",
    path: ["endYear"],
  });

export const certificationSchema = z.object({
  name: text().min(1, "Add the certification name."),
  issuer: text(),
  year,
  url,
});

export const SECTION_SCHEMAS = {
  basics: z.object({
    currentTitle: text(),
    city: text(),
    yearsExperience: z.number().int().min(0).max(50).nullable(),
    linkedinUrl: linkedin,
    portfolioUrl: url,
  }),
  summary: z.object({ summary: text(LIMITS.summary) }),
  skills: z.object({ skills: chips(LIMITS.skills, "skill"), tools: chips(LIMITS.tools, "tool") }),
  eligibility: z.object({
    languages: chips(LIMITS.languages, "language"),
    workCountries: chips(LIMITS.countries, "country"),
    needsSponsorship: z.boolean().nullable(),
    sponsorshipCountries: chips(LIMITS.countries, "country"),
  }),
  preferences: z.object({
    targetRoles: chips(LIMITS.roles, "role"),
    seniority: optionOf(SENIORITY_OPTIONS),
    workModes: multiOf(WORK_MODE_OPTIONS),
    preferredLocations: chips(LIMITS.locations, "location"),
    employmentTypes: multiOf(EMPLOYMENT_TYPE_OPTIONS),
    industries: chips(LIMITS.industries, "industry"),
    openToRelocate: z.boolean().nullable(),
    noticePeriod: optionOf(NOTICE_PERIOD_OPTIONS),
    currentPay: pay,
    expectedPay: pay,
  }),
  optional: z.object({
    gender: optionOf(GENDER_OPTIONS),
    disability: optionOf(YES_NO_PREFER_OPTIONS),
    veteran: optionOf(YES_NO_PREFER_OPTIONS),
  }),
  experience: z.object({ experiences: z.array(experienceSchema).max(LIMITS.experiences) }),
  education: z.object({ educations: z.array(educationSchema).max(LIMITS.educations) }),
  certifications: z.object({ certifications: z.array(certificationSchema).max(LIMITS.certifications) }),
} satisfies Record<SectionKey, z.ZodType>;

export type SectionValues<K extends SectionKey> = z.input<(typeof SECTION_SCHEMAS)[K]>;

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function labelOf(opts: readonly (readonly [string, string])[], v: string): string {
  return opts.find((o) => o[0] === v)?.[1] ?? v;
}
