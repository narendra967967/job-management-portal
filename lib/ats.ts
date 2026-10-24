import "server-only";

// Résumé ATS check — the scoring. Code checks run on the extracted résumé text;
// the AI part compares the résumé with the career profile (target roles, skills,
// seniority). Only career fields relevant to matching are sent to the AI — never
// the optional self-identification answers.

import { createHash } from "node:crypto";
import { z } from "zod";
import { aiComplete } from "@/lib/ai";
import { ATS_WEIGHTS, type AtsPartKey, type AtsResult } from "@/lib/ats-model";
import { labelOf, SENIORITY_OPTIONS, type CareerProfile } from "@/lib/career-profile-model";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** What the check depends on from the profile — changes here make it outdated. */
function profileBasis(p: CareerProfile) {
  return {
    currentTitle: p.currentTitle,
    yearsExperience: p.yearsExperience,
    seniority: p.seniority,
    skills: p.skills,
    tools: p.tools,
    targetRoles: p.targetRoles,
    industries: p.industries,
  };
}
export const profileHash = (p: CareerProfile) => sha(JSON.stringify(profileBasis(p)));
export const resumeHash = (text: string) => sha(text.trim());

/** Résumé text this short almost always means a scanned / image-only file. */
export const MIN_RESUME_CHARS = 400;

/* ---------------- code checks ---------------- */

interface CodeCheck {
  score: number;
  fixes: string[];
}

const SECTION_PATTERNS: [string, RegExp][] = [
  ["Summary", /\b(summary|profile|objective|about me)\b/i],
  ["Experience", /\b(experience|employment|work history|career history)\b/i],
  ["Education", /\b(education|academic|qualifications?)\b/i],
  ["Skills", /\b(skills|competencies|expertise|technologies|tech stack)\b/i],
];

function checkSections(lines: string[]): CodeCheck {
  // Headings are short lines; fall back to "anywhere" with half credit.
  const short = lines.filter((l) => l.length <= 40);
  let score = 0;
  const missing: string[] = [];
  for (const [name, re] of SECTION_PATTERNS) {
    if (short.some((l) => re.test(l))) score += 25;
    else if (lines.some((l) => re.test(l))) score += 12;
    else missing.push(name);
  }
  return {
    score,
    fixes: missing.length
      ? [`Add a clearly titled ${missing.join(", ")} section${missing.length > 1 ? "s" : ""} — ATS parsers look for standard headings.`]
      : [],
  };
}

function checkContact(text: string): CodeCheck {
  const email = /[\w.+-]+@[\w-]+\.[\w.-]+/.test(text);
  const phone = /(\+?\d[\d\s().-]{8,}\d)/.test(text);
  const linkedin = /linkedin\.com\/in\//i.test(text);
  const fixes: string[] = [];
  if (!email) fixes.push("Add your email address at the top of the résumé.");
  if (!phone) fixes.push("Add a phone number at the top of the résumé.");
  if (!linkedin) fixes.push("Add your LinkedIn profile link.");
  return { score: (email ? 40 : 0) + (phone ? 40 : 0) + (linkedin ? 20 : 0), fixes };
}

function checkImpact(lines: string[]): CodeCheck {
  // A line with a number left once years, dates and contact details are taken
  // out ("185 live sites", "40%", "25-member team", "12+ products").
  const quantified = lines.filter((l) => {
    if (/@|linkedin\.com|\+?\d[\d\s().-]{8,}\d/i.test(l)) return false;
    const rest = l.replace(/\b(19|20)\d{2}\b/g, "").replace(/\b\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?\b/g, "");
    return /\d/.test(rest);
  }).length;
  const score = Math.min(100, Math.round((quantified / 6) * 100));
  return {
    score,
    fixes:
      quantified < 6
        ? [`Quantify more achievements (found ${quantified}) — add numbers like %, revenue, users or team size.`]
        : [],
  };
}

function checkLength(words: number): CodeCheck {
  if (words >= 400 && words <= 900) return { score: 100, fixes: [] };
  if (words < 400) {
    return {
      score: words >= 300 ? 75 : words >= 200 ? 50 : 25,
      fixes: ["Your résumé is short — expand your recent roles with achievements and skills."],
    };
  }
  return {
    score: words <= 1200 ? 75 : words <= 1600 ? 50 : 25,
    fixes: ["Your résumé is long — trim older roles and keep it to 1–2 pages."],
  };
}

/* ---------------- AI match ---------------- */

const ATS_SYSTEM = [
  "You are an ATS (applicant tracking system) résumé reviewer. Compare the résumé",
  "with the candidate's target profile and reply with ONLY minified JSON, no markdown:",
  '{"keywordScore":0,"roleFitScore":0,"matchedSkills":[],"missingSkills":[],"fixes":[]}',
  "- keywordScore (0-100): how well the résumé contains the skills, tools and terms",
  "  recruiters search for in the target roles.",
  "- roleFitScore (0-100): how clearly the résumé positions the candidate for the",
  "  target roles and seniority (titles, summary, scope of experience).",
  "- matchedSkills: up to 12 important skills/keywords the résumé clearly shows.",
  "- missingSkills: up to 10 commonly required keywords for the target roles that the",
  "  résumé lacks. Only real, common requirements — no guesses.",
  "- fixes: 3-5 short, specific improvements, one sentence each, starting with a verb.",
  "  Don't comment on layout or fonts (you only see the text).",
  "Be strict and consistent; a typical résumé scores 50-75.",
].join("\n");

const aiReply = z.object({
  keywordScore: z.coerce.number().min(0).max(100),
  roleFitScore: z.coerce.number().min(0).max(100),
  matchedSkills: z.array(z.coerce.string()).default([]),
  missingSkills: z.array(z.coerce.string()).default([]),
  fixes: z.array(z.coerce.string()).default([]),
});

async function aiMatch(userId: string, text: string, p: CareerProfile) {
  const brief = [
    `Target roles: ${p.targetRoles.join(", ")}`,
    `Seniority: ${p.seniority ? labelOf(SENIORITY_OPTIONS, p.seniority) : "not given"}`,
    `Years of experience: ${p.yearsExperience ?? "not given"}`,
    `Current or last title: ${p.currentTitle}`,
    `Skills: ${p.skills.join(", ")}`,
    ...(p.tools.length ? [`Tools: ${p.tools.join(", ")}`] : []),
    ...(p.industries.length ? [`Industries: ${p.industries.join(", ")}`] : []),
    "",
    "RÉSUMÉ TEXT:",
    text.slice(0, 15000),
  ].join("\n");
  const raw = await aiComplete(userId, ATS_SYSTEM, brief, 900, { temperature: 0 });
  const json = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const parsed = aiReply.parse(JSON.parse(json));
  const tidy = (a: string[], n: number) => [...new Set(a.map((s) => s.trim()).filter(Boolean))].slice(0, n).map((s) => s.slice(0, 80));
  return {
    keywordScore: Math.round(parsed.keywordScore),
    roleFitScore: Math.round(parsed.roleFitScore),
    matchedSkills: tidy(parsed.matchedSkills, 12),
    missingSkills: tidy(parsed.missingSkills, 10),
    fixes: tidy(parsed.fixes, 5).map((s) => s.slice(0, 200)),
  };
}

/* ---------------- combine ---------------- */

export async function runAtsCheck(userId: string, resumeText: string, profile: CareerProfile): Promise<AtsResult> {
  const text = resumeText.replace(/\r/g, "");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const words = text.split(/\s+/).filter(Boolean).length;

  const sections = checkSections(lines);
  const contact = checkContact(text);
  const impact = checkImpact(lines);
  const length = checkLength(words);
  const ai = await aiMatch(userId, text, profile);

  const scores: Record<AtsPartKey, number> = {
    keywords: ai.keywordScore,
    role: ai.roleFitScore,
    sections: sections.score,
    impact: impact.score,
    contact: contact.score,
    length: length.score,
  };
  const parts = (Object.keys(ATS_WEIGHTS) as AtsPartKey[]).map((key) => ({
    key,
    ...ATS_WEIGHTS[key],
    score: scores[key],
  }));
  const score = Math.round(parts.reduce((sum, p) => sum + (p.score * p.weight) / 100, 0));

  // Structural problems first (they block parsing), then the AI's content fixes.
  const fixes = [...sections.fixes, ...contact.fixes, ...ai.fixes, ...impact.fixes, ...length.fixes].slice(0, 8);
  return { score, parts, matchedSkills: ai.matchedSkills, missingSkills: ai.missingSkills, fixes };
}
