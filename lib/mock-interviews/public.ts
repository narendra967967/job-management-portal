import "server-only";

import { aiInterviewQuote, lowestRatePerMinute, plannedQuestions, DIFFICULTIES, type Difficulty, type DifficultyPricing } from "./model";
import { aiInterviewsOpen, getModuleSettings } from "./config";
import { db } from "@/lib/db";
import { aiInterviews } from "@/db/schema";

// What the public site may say about AI mock interviews: only while admin has
// switched them to Open (Module settings → Availability), straight from the
// module settings so prices and lengths always match what booking charges.

export interface PublicAiInterviews {
  categories: string[];
  durations: number[];
  /** Per level: the rate per minute and its discount when switched on. Paise. */
  levels: {
    difficulty: Difficulty;
    ratePerMinutePaise: number;
    discountPercent: number;
    finalPerMinutePaise: number;
    /** What each length offered costs at this level, exactly as booking charges it. */
    quotes: { durationMin: number; fullPaise: number; pricePaise: number }[];
  }[];
  /** About how many planned questions each length gets. */
  questions: Record<number, number>;
  /** The lowest per-minute rate after discounts ("from ₹X a minute"). Paise. */
  fromPerMinutePaise: number;
  /** An example: Medium for 30 minutes (or the nearest length offered). */
  example: { difficulty: Difficulty; durationMin: number; pricePaise: number };
  bookingValidDays: number;
  resumeWindowMinutes: number;
}

/**
 * Whether the Privacy Policy describes AI mock interviews: while they're open,
 * and for good once anyone has booked one (that data exists even if the
 * feature is closed again later).
 */
export async function aiInterviewsInPrivacyPolicy(): Promise<boolean> {
  try {
    if (aiInterviewsOpen(await getModuleSettings())) return true;
    const [any] = await db.select({ id: aiInterviews.id }).from(aiInterviews).limit(1);
    return !!any;
  } catch {
    return false;
  }
}

/** null while AI interviews are on Coming soon, or when the database can't be reached (as in `next build`). */
export async function getPublicAiInterviews(): Promise<PublicAiInterviews | null> {
  try {
    const s = await getModuleSettings();
    if (!aiInterviewsOpen(s)) return null;
    const perMinute = (p: DifficultyPricing) => (p.ratePerMinutePaise * (100 - (p.discountOn ? Math.min(100, Math.max(0, p.discountPercent)) : 0))) / 100;
    const exampleMin = s.durations.includes(30) ? 30 : s.durations[0];
    return {
      categories: s.categories,
      durations: s.durations,
      levels: DIFFICULTIES.map((d) => ({
        difficulty: d,
        ratePerMinutePaise: s.pricing[d].ratePerMinutePaise,
        discountPercent: s.pricing[d].discountOn ? s.pricing[d].discountPercent : 0,
        finalPerMinutePaise: perMinute(s.pricing[d]),
        quotes: s.durations.map((m) => {
          const q = aiInterviewQuote(m, s.pricing[d]);
          return { durationMin: m, fullPaise: q.full, pricePaise: q.final };
        }),
      })),
      questions: Object.fromEntries(s.durations.map((m) => [m, plannedQuestions(m, s.minutesPerQuestion)])),
      fromPerMinutePaise: lowestRatePerMinute(s.pricing),
      example: { difficulty: "Medium", durationMin: exampleMin, pricePaise: aiInterviewQuote(exampleMin, s.pricing.Medium).final },
      bookingValidDays: s.bookingValidDays,
      resumeWindowMinutes: s.resumeWindowMinutes,
    };
  } catch {
    return null;
  }
}
