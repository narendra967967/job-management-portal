"use server";

// AI salary insight for one job (#9, premium). Gathers the job (title, company,
// location, JD / AI summary) and the user's default résumé from the DB, asks
// the user's own AI key for a market-rate estimate, validates the JSON, and
// saves it on the job (job_lead_details.salary_insight). This is an estimate
// from the model's general knowledge — NOT live salary data — and says so.

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/current-user";
import { aiComplete, AI_NOT_CONFIGURED } from "@/lib/ai";
import { getFeatureAccess, PREMIUM_REQUIRED } from "@/lib/entitlements";
import { parseInput, zId } from "@/lib/schemas";
import {
  jobLeadDetails as detailsT,
  jobLeads as leadsT,
  resumes as resumesT,
  userSettings as settingsT,
} from "@/db/schema";
import type { SalaryInsight } from "@/lib/types";
import { toSalaryInsight } from "@/lib/salary-parse";
import { salaryMarketFor } from "@/lib/geo";

type Result =
  | { ok: true; insight: SalaryInsight }
  | { ok: false; error: string; locked?: boolean };

const SYSTEM = [
  "You are a compensation analyst. Estimate the market salary for ONE job for",
  "the candidate described, so they can set a realistic expectation.",
  "The input tells you the pay MARKET and CURRENCY. When they are marked FIXED,",
  "use exactly that market's pay levels and that currency — even if the résumé",
  "suggests the candidate lives elsewhere. Only when the market is NOT given,",
  "work it out from the job description (or, failing that, assume India and say",
  "so in the summary).",
  "Give ANNUAL total fixed pay (base / CTC) as plain full numbers in that",
  "currency's units — e.g. 1850000 for ₹18.5 lakh or 145000 for €145k — never",
  "\"18.5L\" or \"€145k\".",
  "Weigh the role's seniority, the company, the city/country market, and the",
  "candidate's experience and skills from their résumé.",
  "You do NOT have live market data: base the estimate on your general",
  "knowledge, keep the range honest, and lower confidence when inputs are thin.",
  "Reply with ONLY minified JSON, no markdown fences, exactly:",
  '{"country":"","currency":"INR","low":0,"typical":0,"high":0,"suggestedAsk":0,"confidence":"medium","summary":"","factors":[""],"tips":[""]}',
  "- currency: ISO 4217 code.",
  "- suggestedAsk: what this candidate could reasonably ask for.",
  "- confidence: \"low\", \"medium\" or \"high\".",
  "- summary: 1–2 sentences explaining the range.",
  "- factors: up to 5 short reasons that move the number up or down.",
  "- tips: up to 4 short, practical negotiation tips for this job.",
].join("\n");

export async function generateSalaryInsightAction(leadId: string): Promise<Result> {
  const userId = await getCurrentUserId();
  if (!(await getFeatureAccess(userId)).salaryInsight) {
    return { ok: false, error: PREMIUM_REQUIRED, locked: true };
  }
  let id: string;
  try {
    id = parseInput(zId, leadId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid lead." };
  }

  const [lead] = await db
    .select({
      title: leadsT.title,
      company: leadsT.company,
      location: leadsT.location,
      remote: leadsT.remote,
    })
    .from(leadsT)
    .where(and(eq(leadsT.id, id), eq(leadsT.userId, userId)));
  if (!lead) return { ok: false, error: "Lead not found." };

  const [detail] = await db
    .select({ jdText: detailsT.jdText, aiSummary: detailsT.aiSummary })
    .from(detailsT)
    .where(and(eq(detailsT.leadId, id), eq(detailsT.userId, userId)));
  const jd = detail?.jdText?.trim() || detail?.aiSummary?.trim() || "";

  // Default résumé: the one chosen in Settings, else the flagged default, else the newest.
  const [settings] = await db
    .select({ defaultResumeId: settingsT.defaultResumeId })
    .from(settingsT)
    .where(eq(settingsT.userId, userId));
  const resumeRows = await db
    .select({
      id: resumesT.id,
      label: resumesT.label,
      text: resumesT.resumeText,
      isDefault: resumesT.isDefault,
    })
    .from(resumesT)
    .where(eq(resumesT.userId, userId))
    .orderBy(desc(resumesT.createdAt));
  const resume =
    resumeRows.find((r) => r.id === settings?.defaultResumeId) ??
    resumeRows.find((r) => r.isDefault) ??
    resumeRows[0];
  const resumeText = resume?.text?.trim() ?? "";

  // The app — not the AI — decides the market + currency whenever the location
  // allows it ("Remote (EU)" → Europe / EUR), so the answer can be checked.
  const market = salaryMarketFor(lead.location);

  const context = [
    `Job: ${lead.title} at ${lead.company}`,
    `Location: ${lead.location}${lead.remote ? " (remote)" : ""}`,
    market
      ? `Pay market (FIXED — do not change): ${market.market}
Currency (FIXED — do not change): ${market.currency}`
      : "Pay market: not clear from the location — infer it from the job description; if still unclear, assume India (INR).",
    jd
      ? `Job description:\n${jd.slice(0, 12000)}`
      : "Job description: not provided — rely on the title, company and location.",
    resumeText
      ? `Candidate résumé${resume ? ` (${resume.label})` : ""}:\n${resumeText.slice(0, 12000)}`
      : "Candidate résumé: not provided — estimate for a typical candidate for this role.",
  ].join("\n\n");

  const label = resumeText && resume ? resume.label : null;
  let insight: SalaryInsight;
  try {
    try {
      insight = toSalaryInsight(await aiComplete(userId, SYSTEM, context, 900), label, market);
    } catch (first) {
      // One retry for an unreadable / wrong-currency answer.
      if (!(first instanceof SyntaxError)) throw first;
      insight = toSalaryInsight(await aiComplete(userId, SYSTEM, context, 900), label, market);
    }
  } catch (err) {
    if (err instanceof SyntaxError) {
      return { ok: false, error: "The AI's answer couldn't be read. Please try again." };
    }
    const msg = err instanceof Error ? err.message : "";
    return {
      ok: false,
      error:
        msg === AI_NOT_CONFIGURED
          ? "No AI key configured. Add your API key in Settings → AI provider."
          : msg || "Couldn't get a salary estimate right now. Please try again.",
    };
  }

  const now = new Date();
  await db
    .insert(detailsT)
    .values({ leadId: id, userId, salaryInsight: insight, salaryInsightAt: now })
    .onConflictDoUpdate({
      target: detailsT.leadId,
      set: { salaryInsight: insight, salaryInsightAt: now },
    });
  return { ok: true, insight };
}
