"use server";

// Career profile (Settings → Career profile). Each section saves on its own;
// input is re-validated here with the section's Zod schema and every write is
// scoped to the session user. Repeatable sections (experience, education,
// certifications) replace the user's list in one transaction, in display order.

import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/current-user";
import { careerProfiles, certifications, educations, workExperiences } from "@/db/schema";
import { loadCareerProfile } from "@/lib/career-data";
import { parseInput } from "@/lib/schemas";
import { SECTION_SCHEMAS, type CareerProfile, type SectionKey } from "@/lib/career-profile-model";

type Result = { ok: true; profile: CareerProfile } | { ok: false; error: string };

export async function getCareerProfileAction(): Promise<CareerProfile> {
  return loadCareerProfile(await getCurrentUserId());
}

const SECTIONS = Object.keys(SECTION_SCHEMAS) as SectionKey[];

async function upsertProfile(userId: string, set: Partial<typeof careerProfiles.$inferInsert>) {
  await db
    .insert(careerProfiles)
    .values({ userId, ...set })
    .onConflictDoUpdate({ target: careerProfiles.userId, set });
}

export async function saveCareerSectionAction(section: SectionKey, values: unknown): Promise<Result> {
  const userId = await getCurrentUserId();
  try {
    if (!SECTIONS.includes(section)) throw new Error("Unknown section.");
    switch (section) {
      case "basics":
      case "summary":
      case "skills":
      case "eligibility":
      case "optional": {
        const v = parseInput(SECTION_SCHEMAS[section] as z.ZodType<Record<string, unknown>>, values);
        // Sponsorship countries only mean something when sponsorship is needed.
        if (section === "eligibility" && v.needsSponsorship !== true) v.sponsorshipCountries = [];
        await upsertProfile(userId, v as Partial<typeof careerProfiles.$inferInsert>);
        break;
      }
      case "preferences": {
        const { currentPay, expectedPay, ...rest } = parseInput(SECTION_SCHEMAS.preferences, values);
        await upsertProfile(userId, {
          ...rest,
          currentPayAmount: currentPay?.amount ?? null,
          currentPayCurrency: currentPay?.currency ?? null,
          currentPayPeriod: currentPay?.period ?? null,
          expectedPayAmount: expectedPay?.amount ?? null,
          expectedPayCurrency: expectedPay?.currency ?? null,
          expectedPayPeriod: expectedPay?.period ?? null,
        });
        break;
      }
      case "experience": {
        const { experiences } = parseInput(SECTION_SCHEMAS.experience, values);
        await db.transaction(async (tx) => {
          await tx.delete(workExperiences).where(eq(workExperiences.userId, userId));
          if (experiences.length)
            await tx.insert(workExperiences).values(
              experiences.map((e, i) => ({
                ...e,
                // A current role has no end date.
                endMonth: e.isCurrent ? null : e.endMonth,
                endYear: e.isCurrent ? null : e.endYear,
                userId,
                sortOrder: i,
              })),
            );
        });
        break;
      }
      case "education": {
        const { educations: rows } = parseInput(SECTION_SCHEMAS.education, values);
        await db.transaction(async (tx) => {
          await tx.delete(educations).where(eq(educations.userId, userId));
          if (rows.length) await tx.insert(educations).values(rows.map((e, i) => ({ ...e, userId, sortOrder: i })));
        });
        break;
      }
      case "certifications": {
        const { certifications: rows } = parseInput(SECTION_SCHEMAS.certifications, values);
        await db.transaction(async (tx) => {
          await tx.delete(certifications).where(eq(certifications.userId, userId));
          if (rows.length)
            await tx.insert(certifications).values(rows.map((c, i) => ({ ...c, userId, sortOrder: i })));
        });
        break;
      }
    }
    return { ok: true, profile: await loadCareerProfile(userId) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't save." };
  }
}
