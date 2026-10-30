import "server-only";

// Career profile — server data layer. Callers pass the session user's id
// (actions / layouts); every query is scoped to it.

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { careerProfiles, certifications, educations, workExperiences } from "@/db/schema";
import {
  EMPTY_PROFILE,
  careerCompletion,
  CURRENCY_OPTIONS,
  labelOf,
  SENIORITY_OPTIONS,
  WORK_MODE_OPTIONS,
  type CareerProfile,
  type Currency,
  type Pay,
} from "@/lib/career-profile-model";

function payOf(amount: number | null, currency: string | null, period: string | null): Pay | null {
  if (amount == null || !(CURRENCY_OPTIONS as readonly string[]).includes(currency ?? "")) return null;
  return { amount, currency: currency as Currency, period: period === "month" ? "month" : "year" };
}

export async function loadCareerProfile(userId: string): Promise<CareerProfile> {
  const [[p], exp, edu, certs] = await Promise.all([
    db.select().from(careerProfiles).where(eq(careerProfiles.userId, userId)),
    db.select().from(workExperiences).where(eq(workExperiences.userId, userId)).orderBy(asc(workExperiences.sortOrder)),
    db.select().from(educations).where(eq(educations.userId, userId)).orderBy(asc(educations.sortOrder)),
    db.select().from(certifications).where(eq(certifications.userId, userId)).orderBy(asc(certifications.sortOrder)),
  ]);
  const base: CareerProfile = p
    ? {
        currentTitle: p.currentTitle,
        city: p.city,
        yearsExperience: p.yearsExperience,
        linkedinUrl: p.linkedinUrl,
        portfolioUrl: p.portfolioUrl,
        summary: p.summary,
        skills: p.skills,
        tools: p.tools,
        languages: p.languages,
        workCountries: p.workCountries,
        needsSponsorship: p.needsSponsorship,
        sponsorshipCountries: p.sponsorshipCountries,
        targetRoles: p.targetRoles,
        seniority: p.seniority,
        workModes: p.workModes,
        preferredLocations: p.preferredLocations,
        employmentTypes: p.employmentTypes,
        industries: p.industries,
        openToRelocate: p.openToRelocate,
        noticePeriod: p.noticePeriod,
        currentPay: payOf(p.currentPayAmount, p.currentPayCurrency, p.currentPayPeriod),
        expectedPay: payOf(p.expectedPayAmount, p.expectedPayCurrency, p.expectedPayPeriod),
        gender: p.gender,
        disability: p.disability,
        veteran: p.veteran,
        experiences: [],
        educations: [],
        certifications: [],
      }
    : { ...EMPTY_PROFILE };
  base.experiences = exp.map((e) => ({
    title: e.title,
    company: e.company,
    location: e.location,
    employmentType: e.employmentType,
    startMonth: e.startMonth,
    startYear: e.startYear,
    endMonth: e.endMonth,
    endYear: e.endYear,
    isCurrent: e.isCurrent,
    description: e.description,
  }));
  base.educations = edu.map((e) => ({
    degree: e.degree,
    field: e.field,
    institution: e.institution,
    startYear: e.startYear,
    endYear: e.endYear,
    grade: e.grade,
  }));
  base.certifications = certs.map((c) => ({ name: c.name, issuer: c.issuer, year: c.year, url: c.url }));
  return base;
}

/** Completion for the header notice. Fails open (treated as complete) if the
 *  database can't be read, so a DB hiccup never nags on every page. */
export async function careerCompletionFor(userId: string): Promise<{ percent: number; complete: boolean }> {
  try {
    const { percent, complete } = careerCompletion(await loadCareerProfile(userId));
    return { percent, complete };
  } catch {
    return { percent: 100, complete: true };
  }
}

/** The career profile as AI context for fit scores and drafts, or "" when it's
 *  empty or unreadable (AI features must still work without it). Only job-fit
 *  fields: never pay, eligibility or the optional questions. */
export async function careerBriefFor(userId: string, opts: { includeSummary?: boolean } = {}): Promise<string> {
  try {
    const p = await loadCareerProfile(userId);
    const list = (label: string, items: string[]) => (items.length ? [`${label}: ${items.join(", ")}`] : []);
    return [
      ...list("Target roles", p.targetRoles),
      ...(p.currentTitle.trim() ? [`Current or last title: ${p.currentTitle.trim()}`] : []),
      ...(p.yearsExperience != null ? [`Years of experience: ${p.yearsExperience}`] : []),
      ...(p.seniority ? [`Seniority: ${labelOf(SENIORITY_OPTIONS, p.seniority)}`] : []),
      ...list("Skills", p.skills),
      ...list("Tools", p.tools),
      ...list("Industries", p.industries),
      ...list("Preferred work mode", p.workModes.map((m) => labelOf(WORK_MODE_OPTIONS, m))),
      ...list("Preferred locations", p.preferredLocations),
      ...(opts.includeSummary && p.summary.trim() ? [`Professional summary: ${p.summary.trim().slice(0, 2000)}`] : []),
    ].join("\n");
  } catch {
    return "";
  }
}
