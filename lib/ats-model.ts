// Résumé ATS check — shared model (client + server).
//
// Hybrid score out of 100: code checks on the résumé text (sections, contact
// details, measurable impact, length) plus an AI match of the résumé against
// the user's career profile (keywords & skills, role alignment). Weights below.

export type AtsPartKey = "keywords" | "role" | "sections" | "impact" | "contact" | "length";

export interface AtsPart {
  key: AtsPartKey;
  label: string;
  /** 0–100 for this part. */
  score: number;
  /** Share of the overall score, in percent. */
  weight: number;
  /** "ai" = from the AI match; "code" = checked directly on the text. */
  source: "ai" | "code";
}

export interface AtsResult {
  score: number;
  parts: AtsPart[];
  matchedSkills: string[];
  missingSkills: string[];
  /** Short, specific improvements, most important first. */
  fixes: string[];
}

export const ATS_WEIGHTS: Record<AtsPartKey, { label: string; weight: number; source: "ai" | "code" }> = {
  keywords: { label: "Keywords & skills", weight: 35, source: "ai" },
  role: { label: "Role alignment", weight: 20, source: "ai" },
  sections: { label: "Standard sections", weight: 15, source: "code" },
  impact: { label: "Measurable impact", weight: 15, source: "code" },
  contact: { label: "Contact details", weight: 10, source: "code" },
  length: { label: "Length", weight: 5, source: "code" },
};

export interface AtsCheckView {
  checkedAt: string;
  result: AtsResult;
  /** The résumé text or the relevant profile fields changed since the check. */
  outdated: boolean;
}

/** Everything the Resumes card needs to show each row's ATS state. */
export interface AtsOverview {
  /** The user's plan includes the ATS check. */
  allowed: boolean;
  hasAiKey: boolean;
  profilePercent: number;
  profileComplete: boolean;
  /** Latest check per résumé id (absent = never checked). */
  checks: Record<string, AtsCheckView>;
}

export function atsTone(score: number): "good" | "fair" | "poor" {
  return score >= 80 ? "good" : score >= 60 ? "fair" : "poor";
}
