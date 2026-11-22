import "server-only";

import { aiInterviewQuote, lowestRatePerMinute, DIFFICULTIES, type Difficulty, type DifficultyPricing } from "./model";
import { aiInterviewsOpen, getModuleSettings } from "./config";

// What the public site may say about AI mock interviews: only while admin has
// switched them to Open (Module settings → Availability), straight from the
// module settings so prices and lengths always match what booking charges.

export interface PublicAiInterviews {
  categories: string[];
  durations: number[];
  /** Per level: the rate per minute and its discount when switched on. Paise. */
  levels: { difficulty: Difficulty; ratePerMinutePaise: number; discountPercent: number; finalPerMinutePaise: number }[];
  /** The lowest per-minute rate after discounts ("from ₹X a minute"). Paise. */
  fromPerMinutePaise: number;
  /** An example: Medium for 30 minutes (or the nearest length offered). */
  example: { difficulty: Difficulty; durationMin: number; pricePaise: number };
  bookingValidDays: number;
  resumeWindowMinutes: number;
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
      })),
      fromPerMinutePaise: lowestRatePerMinute(s.pricing),
      example: { difficulty: "Medium", durationMin: exampleMin, pricePaise: aiInterviewQuote(exampleMin, s.pricing.Medium).final },
      bookingValidDays: s.bookingValidDays,
      resumeWindowMinutes: s.resumeWindowMinutes,
    };
  } catch {
    return null;
  }
}
