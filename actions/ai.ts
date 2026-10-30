"use server";

// AI Server Actions (Milestone C) — real summaries / contact structuring /
// outreach drafting via the user's configured provider + key (lib/ai). Each
// returns a serializable result so the client can show a friendly error (e.g.
// when no API key is set in Settings). Scoped to the current user.

import { and, eq } from "drizzle-orm";
import { advanceLeadStatus, type AutoStatusChange } from "@/lib/auto-status";
import { db } from "@/lib/db";
import { careerBriefFor } from "@/lib/career-data";
import { getCurrentUserId } from "@/lib/current-user";
import { aiAddAllowance, getFeatureAccess, PREMIUM_REQUIRED, recordUsage } from "@/lib/entitlements";
import {
  aiComplete,
  aiCompleteVision,
  AI_NOT_CONFIGURED,
  type VisionImage,
} from "@/lib/ai";
import {
  DEFAULT_SUMMARY_PROMPT,
  DEFAULT_DRAFT_PROMPT,
  DEFAULT_SCORE_PROMPT,
} from "@/lib/ai-prompts";
import {
  contactTextSchema,
  draftInputSchema,
  jdInputSchema,
  leadExtractTextSchema,
  parseInput,
  promptPreviewSchema,
  scoreFitSchema,
} from "@/lib/schemas";
import {
  appAiConfig,
  contacts as contactsT,
  fitScores as fitScoresT,
  jobLeadDetails as detailsT,
  jobLeads as leadsT,
  resumes as resumesT,
  userSettings as settingsT,
} from "@/db/schema";
import {
  AI_PROVIDER_DEFAULT_MODEL,
  CONNECTION_TYPE_LABELS,
  OUTREACH_KIND_LABELS,
  type ConnectionType,
  type OutreachKind,
} from "@/lib/types";

const NO_KEY_MSG =
  "No AI key configured. Add your API key in Settings → AI provider.";

function friendly(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === AI_NOT_CONFIGURED) return NO_KEY_MSG;
  return msg || "AI request failed.";
}

/** Settings → AI provider: one tiny call with the saved key and model, so a bad
 *  key shows up here and not later inside an AI feature. Provider error bodies
 *  are never shown; they can echo account details. */
export async function testAiKeyAction(): Promise<
  { ok: true; model: string } | { ok: false; error: string }
> {
  const userId = await getCurrentUserId();
  try {
    await aiComplete(userId, "Reply with the single word OK.", "Test", 16, { timeoutMs: 20_000 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === AI_NOT_CONFIGURED) return { ok: false, error: NO_KEY_MSG };
    if (/ error (401|403)\b/.test(msg)) {
      return { ok: false, error: "Your key was rejected. Check that the provider matches the key and that you copied all of it." };
    }
    if (/ error 402\b/.test(msg)) return { ok: false, error: "Your provider says you're out of credit. Add credit in your provider's account." };
    if (/ error 429\b/.test(msg)) return { ok: false, error: "Your provider is busy or you've hit a limit. Try again in a moment." };
    if (/ error (400|404)\b/.test(msg)) return { ok: false, error: "Your provider didn't accept this model. Clear the Model box to use the suggested one." };
    if (err instanceof Error && err.name === "TimeoutError") return { ok: false, error: "Your provider took too long to answer. Try again in a moment." };
    console.error("[ai] key test failed:", msg.slice(0, 200));
    return { ok: false, error: "We couldn't reach your provider. Try again in a moment." };
  }
  const [s] = await db
    .select({ provider: settingsT.aiProvider, model: settingsT.aiModel })
    .from(settingsT)
    .where(eq(settingsT.userId, userId));
  return { ok: true, model: s?.model?.trim() || AI_PROVIDER_DEFAULT_MODEL[s?.provider ?? "openai"] };
}

type PromptKind = "summary" | "draft" | "score";

/**
 * Resolve the system prompt for an AI operation: the user's own prompt wins; if
 * they haven't set one, fall back to the admin-configured default (Settings → AI,
 * app_ai_config); finally the built-in default. Lets the admin set org-wide
 * defaults that users can still override.
 */
async function effectivePrompt(userId: string, kind: PromptKind): Promise<string> {
  const [own] = await db
    .select({
      summary: settingsT.promptSummary,
      draft: settingsT.promptDraft,
      score: settingsT.promptScore,
    })
    .from(settingsT)
    .where(eq(settingsT.userId, userId));
  const ownPrompt = (kind === "summary" ? own?.summary : kind === "draft" ? own?.draft : own?.score)?.trim();
  // A saved custom prompt applies only while the plan includes custom prompts.
  if (ownPrompt && (await getFeatureAccess(userId)).customPrompts) return ownPrompt;

  const [admin] = await db
    .select({
      summary: appAiConfig.defaultPromptSummary,
      draft: appAiConfig.defaultPromptDraft,
      score: appAiConfig.defaultPromptScore,
    })
    .from(appAiConfig)
    .limit(1);
  const adminPrompt = (kind === "summary" ? admin?.summary : kind === "draft" ? admin?.draft : admin?.score)?.trim();
  if (adminPrompt) return adminPrompt;

  return kind === "summary"
    ? DEFAULT_SUMMARY_PROMPT
    : kind === "draft"
      ? DEFAULT_DRAFT_PROMPT
      : DEFAULT_SCORE_PROMPT;
}

/* ---------------- Save JD only (FR-3.1) — no AI ---------------- */

export async function saveJdAction(
  leadId: string,
  jdText: string,
): Promise<{ ok: true; autoStatus: AutoStatusChange | null } | { ok: false; error: string }> {
  const userId = await getCurrentUserId();
  let text: string;
  try {
    ({ leadId, jdText: text } = parseInput(jdInputSchema, { leadId, jdText }));
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }

  const [lead] = await db
    .select({ id: leadsT.id })
    .from(leadsT)
    .where(and(eq(leadsT.id, leadId), eq(leadsT.userId, userId)));
  if (!lead) return { ok: false, error: "Lead not found." };

  await db
    .insert(detailsT)
    .values({ leadId, userId, jdText: text })
    .onConflictDoUpdate({ target: detailsT.leadId, set: { jdText: text } });
  // Saving a JD means you're looking into this job → Shortlisted.
  const autoStatus = await advanceLeadStatus(db, userId, leadId, "shortlisted");
  return { ok: true, autoStatus };
}

/* ---------------- JD summary (FR-3.3) — stores JD + summary ---------------- */

export async function summarizeJdAction(
  leadId: string,
  jdText: string,
): Promise<
  | { ok: true; summary: string; autoStatus: AutoStatusChange | null }
  | { ok: false; error: string; autoStatus?: AutoStatusChange | null }
> {
  const userId = await getCurrentUserId();
  let text: string;
  try {
    ({ leadId, jdText: text } = parseInput(jdInputSchema, { leadId, jdText }));
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }

  const [lead] = await db
    .select({ id: leadsT.id })
    .from(leadsT)
    .where(and(eq(leadsT.id, leadId), eq(leadsT.userId, userId)));
  if (!lead) return { ok: false, error: "Lead not found." };

  // Persist the pasted JD immediately (FR-3.1/3.3) so it's saved to this lead
  // even if the AI summary fails (e.g. no API key). Keep any existing summary.
  await db
    .insert(detailsT)
    .values({ leadId, userId, jdText: text })
    .onConflictDoUpdate({ target: detailsT.leadId, set: { jdText: text } });
  // The JD is saved either way → Shortlisted (reported even if the AI fails).
  const autoStatus = await advanceLeadStatus(db, userId, leadId, "shortlisted");

  try {
    const system = await effectivePrompt(userId, "summary");
    const summary = await aiComplete(userId, system, text, 300);
    await db
      .update(detailsT)
      .set({ aiSummary: summary })
      .where(eq(detailsT.leadId, leadId));
    return { ok: true, summary, autoStatus };
  } catch (err) {
    return { ok: false, error: friendly(err), autoStatus };
  }
}

/* ---------------- Structure pasted contact text (FR-3.2) ------------------- */

export interface ParsedContact {
  name: string;
  title: string;
  linkedinUrl: string;
  connectionType: ConnectionType;
}

const CONNECTION_TYPES = Object.keys(CONNECTION_TYPE_LABELS) as ConnectionType[];

export async function structureContactAction(
  pastedText: string,
): Promise<{ ok: true; contact: ParsedContact } | { ok: false; error: string }> {
  const userId = await getCurrentUserId();
  let text: string;
  try {
    text = parseInput(contactTextSchema, pastedText);
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }

  try {
    const raw = await aiComplete(
      userId,
      'Extract a single contact from pasted LinkedIn hiring-team/referral text. Reply with ONLY minified JSON: {"name","title","linkedinUrl","connectionType"}. connectionType must be one of: recruiter, referral, hiring-manager, other. Use "" for any unknown field.',
      text,
      200,
    );
    const json = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(json) as Partial<ParsedContact>;
    const connectionType = CONNECTION_TYPES.includes(
      parsed.connectionType as ConnectionType,
    )
      ? (parsed.connectionType as ConnectionType)
      : "other";
    return {
      ok: true,
      contact: {
        name: (parsed.name ?? "").toString(),
        title: (parsed.title ?? "").toString(),
        linkedinUrl: (parsed.linkedinUrl ?? "").toString(),
        connectionType,
      },
    };
  } catch (err) {
    if (err instanceof SyntaxError) {
      return {
        ok: false,
        error: "Couldn't parse that automatically — please fill the fields manually.",
      };
    }
    return { ok: false, error: friendly(err) };
  }
}

/* ---------------- Draft outreach (FR-4.1 / FR-4.2) ------------------------- */

// Enough for the draft to pick out real experience without a huge prompt.
const DRAFT_RESUME_CHARS = 8000;

export async function draftOutreachAction(input: {
  leadId: string;
  contactId: string;
  kind: OutreachKind;
  resumeId?: string;
}): Promise<{ ok: true; draft: string } | { ok: false; error: string }> {
  const userId = await getCurrentUserId();
  if (!(await getFeatureAccess(userId)).aiDrafts) return { ok: false, error: PREMIUM_REQUIRED };
  try {
    input = parseInput(draftInputSchema, input) as typeof input;
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }

  const [lead] = await db
    .select({ title: leadsT.title, company: leadsT.company })
    .from(leadsT)
    .where(and(eq(leadsT.id, input.leadId), eq(leadsT.userId, userId)));
  if (!lead) return { ok: false, error: "Lead not found." };

  const [contact] = await db
    .select({
      name: contactsT.name,
      title: contactsT.title,
      connectionType: contactsT.connectionType,
    })
    .from(contactsT)
    .where(and(eq(contactsT.id, input.contactId), eq(contactsT.userId, userId)));
  if (!contact) return { ok: false, error: "Contact not found." };

  const [detail] = await db
    .select({ jdText: detailsT.jdText, aiSummary: detailsT.aiSummary })
    .from(detailsT)
    .where(and(eq(detailsT.leadId, input.leadId), eq(detailsT.userId, userId)));

  const jd = detail?.aiSummary || detail?.jdText || "(no job description saved yet)";

  const [resume] = input.resumeId
    ? await db
        .select({ label: resumesT.label, text: resumesT.resumeText })
        .from(resumesT)
        .where(and(eq(resumesT.id, input.resumeId), eq(resumesT.userId, userId)))
    : [];
  const resumeText = resume?.text?.trim();
  const career = await careerBriefFor(userId, { includeSummary: true });

  const context = [
    `Message type: ${OUTREACH_KIND_LABELS[input.kind]}`,
    `Recipient: ${contact.name}${contact.title ? `, ${contact.title}` : ""} (${CONNECTION_TYPE_LABELS[contact.connectionType]})`,
    `Role: ${lead.title} at ${lead.company}`,
    `Job context: ${jd}`,
    ...(resumeText ? [`My resume (${resume.label}):\n${resumeText.slice(0, DRAFT_RESUME_CHARS)}`] : []),
    ...(career ? [`My career profile:\n${career}`] : []),
  ].join("\n");

  try {
    const system = await effectivePrompt(userId, "draft");
    const draft = await aiComplete(userId, system, context, 500);
    return { ok: true, draft };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

/* ---------------- Fit scoring (FR — AI, on demand) ------------------------ */

// Score a lead against a resume with the configured AI provider and cache the
// result. Never runs automatically — triggered by the user's Calculate/Rescore
// button — because it spends tokens per call.
export async function scoreFitAction(
  leadId: string,
  resumeId: string,
): Promise<
  | { ok: true; score: number; rationale: string; autoStatus: AutoStatusChange | null }
  | { ok: false; error: string }
> {
  const userId = await getCurrentUserId();
  let input: { leadId: string; resumeId: string };
  try {
    input = parseInput(scoreFitSchema, { leadId, resumeId });
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }

  const [lead] = await db
    .select({ title: leadsT.title, company: leadsT.company })
    .from(leadsT)
    .where(and(eq(leadsT.id, input.leadId), eq(leadsT.userId, userId)));
  if (!lead) return { ok: false, error: "Lead not found." };

  const [detail] = await db
    .select({ jdText: detailsT.jdText, aiSummary: detailsT.aiSummary })
    .from(detailsT)
    .where(and(eq(detailsT.leadId, input.leadId), eq(detailsT.userId, userId)));
  const jd = detail?.aiSummary?.trim() || detail?.jdText?.trim();
  if (!jd) {
    return { ok: false, error: "Add a job description for this lead first." };
  }

  const [resume] = await db
    .select({ label: resumesT.label, text: resumesT.resumeText })
    .from(resumesT)
    .where(and(eq(resumesT.id, input.resumeId), eq(resumesT.userId, userId)));
  if (!resume) return { ok: false, error: "Resume not found." };
  const resumeText = resume.text?.trim();
  if (!resumeText) {
    return {
      ok: false,
      error: `Add the résumé text for "${resume.label}" in Settings → Resumes first.`,
    };
  }

  try {
    const career = await careerBriefFor(userId);
    const base = await effectivePrompt(userId, "score");
    // Enforce a parseable output regardless of the (possibly custom) prompt.
    const system = `${base}\n\nReply with ONLY minified JSON: {"score": <integer 0-100>, "rationale": "<one sentence>"}. No other text.`;
    const context = [
      `Role: ${lead.title} at ${lead.company}`,
      `Job description / summary:\n${jd}`,
      `Candidate resume (${resume.label}):\n${resumeText}`,
      ...(career ? [`Candidate's career profile (their stated goals and skills; the resume is the evidence):\n${career}`] : []),
    ].join("\n\n");

    const raw = await aiComplete(userId, system, context, 300);
    const json = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

    let score: number | undefined;
    let rationale = "";
    try {
      const parsed = JSON.parse(json) as { score?: unknown; rationale?: unknown };
      score = Math.round(Number(parsed.score));
      rationale = (parsed.rationale ?? "").toString();
    } catch {
      // Fallback for a non-JSON custom prompt: take the first 0–100 number.
      const m = raw.match(/\b(100|\d{1,2})\b/);
      if (m) {
        score = Number(m[1]);
        rationale = raw.trim().slice(0, 300);
      }
    }
    if (score === undefined || !Number.isFinite(score)) {
      return {
        ok: false,
        error:
          "Couldn't read a score from the AI response — try again or adjust the score prompt.",
      };
    }
    score = Math.max(0, Math.min(100, score));

    await db
      .insert(fitScoresT)
      .values({
        userId,
        leadId: input.leadId,
        resumeId: input.resumeId,
        score,
        rationale: rationale || null,
      })
      .onConflictDoUpdate({
        target: [fitScoresT.userId, fitScoresT.leadId, fitScoresT.resumeId],
        set: { score, rationale: rationale || null },
      });

    // Checking your fit means you're evaluating it → Shortlisted.
    const autoStatus = await advanceLeadStatus(db, userId, input.leadId, "shortlisted");
    return { ok: true, score, rationale, autoStatus };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

/* ---------------- Lead extraction (Add-lead "Add with AI" tab) ------------ */

/** Lead fields the AI extractor fills into the manual Add-lead form. */
export interface ExtractedLead {
  title: string;
  company: string;
  location: string;
  remote: boolean;
  jobUrl: string;
  tags: string[];
  jdText: string;
}

const LEAD_EXTRACT_SYSTEM = [
  "You extract a single job lead from the content provided (a job posting, an",
  "email, or a screenshot of one).",
  'Reply with ONLY minified JSON, no markdown fences, matching exactly:',
  '{"title":"","company":"","location":"","remote":false,"jobUrl":"","tags":[],"jdText":""}',
  "- title: the job title.",
  "- company: the hiring company.",
  "- location: city / region, else \"\".",
  "- remote: true ONLY if the role is explicitly remote.",
  "- jobUrl: the application / posting URL if visibly present, else \"\".",
  "- tags: up to 6 short skill or seniority keywords.",
  "- jdText: the job description copied WORD FOR WORD — every section (about the",
  "  role, responsibilities, requirements, benefits…) in its original order and",
  "  wording. Never summarize, shorten, rephrase or translate it. Leave out only",
  "  what isn't part of the posting: site navigation, buttons (Apply, Save…), other",
  "  job listings, ads, email headers/footers. Keep the line breaks; put headings on",
  "  their own line and write list items as \"- \" lines. Plain text only — no",
  "  bold (**), headings (#) or other Markdown. \"\" if there is none.",
  "  On job-board pages (LinkedIn etc.) the posting is the \"About the job\" text;",
  "  leave out the site's extras — AI/premium tips, applicant statistics, company",
  "  insights and hiring trends, \"About the company\", \"More jobs\"/similar jobs.",
  "- Copy only text you can actually read. If some text is too small or blurry to",
  "  read, leave it out. NEVER fill in typical or plausible job-description wording",
  "  that isn't visibly there — a shorter, true jdText is always better.",
  'Use "", [] or false for anything not present. Never invent values.',
].join("\n");

// Reply budgets: the JD comes back word for word, so leave room for a long one
// (pasted text is capped at 20,000 characters ≈ 5,000 tokens).
const EXTRACT_TEXT_MAX_TOKENS = 8000;
const EXTRACT_IMAGE_MAX_TOKENS = 6000;

// Accepted screenshot types + size caps for the image path. A long screenshot
// arrives as several slices (lib/screenshot-tiles.ts), top to bottom.
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB each
const IMAGE_MAX_COUNT = 14; // keep in step with MAX_SLICES

/** Strip Markdown emphasis / heading markers the model sometimes adds to the
 *  JD; keep the wording, line breaks and "- " bullets. */
function plainJd(s: string): string {
  return s
    .split("\n")
    .map((l) => l.replace(/^#{1,6}\s+/, "").replace(/\*{2,}|__/g, ""))
    .join("\n")
    .trim();
}

/** Coerce the model's JSON into a safe ExtractedLead (bad shapes → empties). */
function sanitizeExtracted(raw: string): ExtractedLead {
  const json = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const p = JSON.parse(json) as Partial<Record<keyof ExtractedLead, unknown>>;
  const str = (v: unknown) => (v == null ? "" : String(v)).trim();
  const tags = Array.isArray(p.tags)
    ? [...new Set(p.tags.map((t) => String(t).trim()).filter(Boolean))].slice(0, 6)
    : [];
  return {
    title: str(p.title).slice(0, 200),
    company: str(p.company).slice(0, 200),
    location: str(p.location).slice(0, 200),
    remote: p.remote === true || String(p.remote).toLowerCase() === "true",
    jobUrl: str(p.jobUrl).slice(0, 2048),
    tags,
    jdText: plainJd(str(p.jdText)).slice(0, 50000),
  };
}

function extractFailure(err: unknown): { ok: false; error: string } {
  if (err instanceof SyntaxError) {
    return {
      ok: false,
      error:
        "Couldn't read structured details from that — try clearer text/image, or fill the form manually.",
    };
  }
  return { ok: false, error: friendly(err) };
}

/** Add with AI: refuse once the plan's monthly allowance is used up. */
async function aiAddBlocked(userId: string): Promise<string | null> {
  const a = await aiAddAllowance(userId);
  if (a.left === null || a.left > 0) return null;
  return `You've used all ${a.limit} "Add with AI" uses for this month. Add the job by hand, or upgrade your plan for unlimited use.`;
}

/** Extract lead fields from a pasted paragraph / job description. */
export async function extractLeadFromTextAction(
  text: string,
): Promise<{ ok: true; lead: ExtractedLead } | { ok: false; error: string }> {
  const userId = await getCurrentUserId();
  const blocked = await aiAddBlocked(userId);
  if (blocked) return { ok: false, error: blocked };
  let clean: string;
  try {
    clean = parseInput(leadExtractTextSchema, text);
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
  try {
    // Temperature 0: copying, not writing.
    const raw = await aiComplete(userId, LEAD_EXTRACT_SYSTEM, clean, EXTRACT_TEXT_MAX_TOKENS, {
      temperature: 0,
    });
    const lead = sanitizeExtracted(raw);
    await recordUsage(userId, "ai_add");
    return { ok: true, lead };
  } catch (err) {
    return extractFailure(err);
  }
}

/** Extract lead fields from a pasted / uploaded screenshot (vision model). */
export async function extractLeadFromImageAction(
  formData: FormData,
): Promise<{ ok: true; lead: ExtractedLead } | { ok: false; error: string }> {
  const userId = await getCurrentUserId();
  const blocked = await aiAddBlocked(userId);
  if (blocked) return { ok: false, error: blocked };

  const files = formData.getAll("image").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return { ok: false, error: "Add an image to extract from." };
  }
  if (files.length > IMAGE_MAX_COUNT) {
    return { ok: false, error: "That screenshot is too long — crop it to the job post." };
  }
  if (files.some((f) => !IMAGE_TYPES.includes(f.type))) {
    return { ok: false, error: "Use a PNG, JPEG, or WebP image." };
  }
  if (files.some((f) => f.size > IMAGE_MAX_BYTES)) {
    return { ok: false, error: "Image is too large (max 5 MB)." };
  }

  const images: VisionImage[] = await Promise.all(
    files.map(async (f) => ({
      base64: Buffer.from(await f.arrayBuffer()).toString("base64"),
      mimeType: f.type,
    })),
  );
  const prompt =
    images.length === 1
      ? "Extract the job lead from this screenshot."
      : `These ${images.length} images are consecutive slices of ONE long screenshot, in order from top to bottom. Neighboring slices overlap a little — include overlapping lines only once. Extract the job lead from the whole screenshot.`;

  try {
    const raw = await aiCompleteVision(
      userId,
      LEAD_EXTRACT_SYSTEM,
      prompt,
      images,
      EXTRACT_IMAGE_MAX_TOKENS,
    );
    const lead = sanitizeExtracted(raw);
    await recordUsage(userId, "ai_add");
    return { ok: true, lead };
  } catch (err) {
    return extractFailure(err);
  }
}

/* ---------------- Prompt preview / test (no DB write) --------------------- */

// Run an unsaved prompt against sample input so the user can eyeball the result
// before saving it in Settings → AI prompts. Uses the current user's key.
export async function previewPromptAction(
  system: string,
  input: string,
): Promise<{ ok: true; output: string } | { ok: false; error: string }> {
  const userId = await getCurrentUserId();
  let parsed: { system: string; input: string };
  try {
    parsed = parseInput(promptPreviewSchema, { system, input });
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
  try {
    const output = await aiComplete(userId, parsed.system, parsed.input, 500);
    return { ok: true, output };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

/** "Add with AI" uses left this month, for the Add lead dialog (limit null = unlimited). */
export async function getAiAddAllowanceAction(): Promise<{ limit: number | null; used: number; left: number | null }> {
  return aiAddAllowance(await getCurrentUserId());
}
