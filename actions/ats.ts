"use server";

// Résumé ATS check (Settings → Resumes). Gated four ways, all on the server:
// plan switch (allowAtsCheck), the user's own AI key, a complete career
// profile, and readable résumé text. The latest result per résumé is stored
// with hashes of what it was based on, so the UI can say when it's outdated.

import { and, eq } from "drizzle-orm";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/current-user";
import { resumeAtsChecks, resumes } from "@/db/schema";
import { getFeatureAccess, PREMIUM_REQUIRED } from "@/lib/entitlements";
import { userHasAiKey, AI_NOT_CONFIGURED } from "@/lib/ai";
import { loadCareerProfile } from "@/lib/career-data";
import { careerCompletion } from "@/lib/career-profile-model";
import { MIN_RESUME_CHARS, profileHash, resumeHash, runAtsCheck } from "@/lib/ats";
import type { AtsCheckView, AtsOverview, AtsResult } from "@/lib/ats-model";

export async function getAtsOverviewAction(): Promise<AtsOverview> {
  const userId = await getCurrentUserId();
  const [access, hasAiKey, profile, rows] = await Promise.all([
    getFeatureAccess(userId),
    userHasAiKey(userId),
    loadCareerProfile(userId),
    db
      .select({
        resumeId: resumeAtsChecks.resumeId,
        result: resumeAtsChecks.result,
        resumeHash: resumeAtsChecks.resumeHash,
        profileHash: resumeAtsChecks.profileHash,
        checkedAt: resumeAtsChecks.checkedAt,
        text: resumes.resumeText,
      })
      .from(resumeAtsChecks)
      .innerJoin(resumes, eq(resumes.id, resumeAtsChecks.resumeId))
      .where(eq(resumeAtsChecks.userId, userId)),
  ]);
  const { percent, complete } = careerCompletion(profile);
  const pHash = profileHash(profile);
  const checks: Record<string, AtsCheckView> = {};
  for (const r of rows) {
    checks[r.resumeId] = {
      checkedAt: r.checkedAt.toISOString(),
      result: r.result as AtsResult,
      outdated: r.profileHash !== pHash || r.resumeHash !== resumeHash(r.text ?? ""),
    };
  }
  return { allowed: access.atsCheck, hasAiKey, profilePercent: percent, profileComplete: complete, checks };
}

function friendlyAtsError(err: unknown): string {
  if (err instanceof SyntaxError || err instanceof ZodError) {
    return "The AI reply couldn't be read. Try again.";
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === AI_NOT_CONFIGURED) return "Add your AI key in Settings → AI provider first.";
  if (/ error (401|403)\b/.test(msg)) return "Your AI key was rejected. Check it in Settings → AI provider.";
  if (/ error (402|429)\b/.test(msg)) return "Your AI provider is out of credit or busy. Try again later.";
  return "The ATS check couldn't finish. Try again.";
}

export async function runAtsCheckAction(
  resumeId: string,
): Promise<{ ok: true; check: AtsCheckView } | { ok: false; error: string }> {
  const userId = await getCurrentUserId();
  if (typeof resumeId !== "string" || !/^[0-9a-f-]{36}$/i.test(resumeId)) {
    return { ok: false, error: "Résumé not found." };
  }
  const [access, hasKey, profile, [resume]] = await Promise.all([
    getFeatureAccess(userId),
    userHasAiKey(userId),
    loadCareerProfile(userId),
    db
      .select({ text: resumes.resumeText })
      .from(resumes)
      .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId))),
  ]);
  if (!access.atsCheck) return { ok: false, error: PREMIUM_REQUIRED };
  if (!hasKey) return { ok: false, error: "Add your AI key in Settings → AI provider first." };
  if (!careerCompletion(profile).complete) {
    return { ok: false, error: "Complete your career profile first (Settings → Career profile)." };
  }
  if (!resume) return { ok: false, error: "Résumé not found." };
  const text = (resume.text ?? "").trim();
  if (text.length < MIN_RESUME_CHARS) {
    return {
      ok: false,
      error: "We couldn't read enough text from this résumé. Add its text with the résumé-text button, or upload a text-based PDF.",
    };
  }

  let result: AtsResult;
  try {
    result = await runAtsCheck(userId, text, profile);
  } catch (err) {
    console.error("[ats] check failed:", err instanceof Error ? err.message : err);
    return { ok: false, error: friendlyAtsError(err) };
  }

  const now = new Date();
  const values = {
    score: result.score,
    result,
    resumeHash: resumeHash(text),
    profileHash: profileHash(profile),
    checkedAt: now,
  };
  await db
    .insert(resumeAtsChecks)
    .values({ resumeId, userId, ...values })
    .onConflictDoUpdate({ target: resumeAtsChecks.resumeId, set: values });
  return { ok: true, check: { checkedAt: now.toISOString(), result, outdated: false } };
}
