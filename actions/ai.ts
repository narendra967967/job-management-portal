"use server";

// AI Server Actions (Milestone C) — real summaries / contact structuring /
// outreach drafting via the user's configured provider + key (lib/ai). Each
// returns a serializable result so the client can show a friendly error (e.g.
// when no API key is set in Settings). Scoped to the current user.

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/current-user";
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
  contacts as contactsT,
  fitScores as fitScoresT,
  jobLeadDetails as detailsT,
  jobLeads as leadsT,
  resumes as resumesT,
  userSettings as settingsT,
} from "@/db/schema";
import {
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

/* ---------------- Save JD only (FR-3.1) — no AI ---------------- */

export async function saveJdAction(
  leadId: string,
  jdText: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
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
  return { ok: true };
}

/* ---------------- JD summary (FR-3.3) — stores JD + summary ---------------- */

export async function summarizeJdAction(
  leadId: string,
  jdText: string,
): Promise<{ ok: true; summary: string } | { ok: false; error: string }> {
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

  try {
    const [s] = await db
      .select({ p: settingsT.promptSummary })
      .from(settingsT)
      .where(eq(settingsT.userId, userId));
    const system = s?.p?.trim() || DEFAULT_SUMMARY_PROMPT;
    const summary = await aiComplete(userId, system, text, 300);
    await db
      .update(detailsT)
      .set({ aiSummary: summary })
      .where(eq(detailsT.leadId, leadId));
    return { ok: true, summary };
  } catch (err) {
    return { ok: false, error: friendly(err) };
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

export async function draftOutreachAction(input: {
  leadId: string;
  contactId: string;
  kind: OutreachKind;
  resumeLabel: string;
}): Promise<{ ok: true; draft: string } | { ok: false; error: string }> {
  const userId = await getCurrentUserId();
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

  const context = [
    `Message type: ${OUTREACH_KIND_LABELS[input.kind]}`,
    `Recipient: ${contact.name}${contact.title ? `, ${contact.title}` : ""} (${CONNECTION_TYPE_LABELS[contact.connectionType]})`,
    `Role: ${lead.title} at ${lead.company}`,
    `My resume: ${input.resumeLabel}`,
    `Job context: ${jd}`,
  ].join("\n");

  try {
    const [s] = await db
      .select({ p: settingsT.promptDraft })
      .from(settingsT)
      .where(eq(settingsT.userId, userId));
    const system = s?.p?.trim() || DEFAULT_DRAFT_PROMPT;
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
  { ok: true; score: number; rationale: string } | { ok: false; error: string }
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
    const [s] = await db
      .select({ p: settingsT.promptScore })
      .from(settingsT)
      .where(eq(settingsT.userId, userId));
    const base = s?.p?.trim() || DEFAULT_SCORE_PROMPT;
    // Enforce a parseable output regardless of the (possibly custom) prompt.
    const system = `${base}\n\nReply with ONLY minified JSON: {"score": <integer 0-100>, "rationale": "<one sentence>"}. No other text.`;
    const context = [
      `Role: ${lead.title} at ${lead.company}`,
      `Job description / summary:\n${jd}`,
      `Candidate resume (${resume.label}):\n${resumeText}`,
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

    return { ok: true, score, rationale };
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
  "- jdText: the job description text, cleaned of boilerplate; \"\" if none.",
  'Use "", [] or false for anything not present. Never invent values.',
].join("\n");

// Accepted screenshot types + size cap for the image path.
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

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
    jdText: str(p.jdText).slice(0, 50000),
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

/** Extract lead fields from a pasted paragraph / job description. */
export async function extractLeadFromTextAction(
  text: string,
): Promise<{ ok: true; lead: ExtractedLead } | { ok: false; error: string }> {
  const userId = await getCurrentUserId();
  let clean: string;
  try {
    clean = parseInput(leadExtractTextSchema, text);
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
  try {
    const raw = await aiComplete(userId, LEAD_EXTRACT_SYSTEM, clean, 1200);
    return { ok: true, lead: sanitizeExtracted(raw) };
  } catch (err) {
    return extractFailure(err);
  }
}

/** Extract lead fields from a pasted / uploaded screenshot (vision model). */
export async function extractLeadFromImageAction(
  formData: FormData,
): Promise<{ ok: true; lead: ExtractedLead } | { ok: false; error: string }> {
  const userId = await getCurrentUserId();

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Add an image to extract from." };
  }
  if (!IMAGE_TYPES.includes(file.type)) {
    return { ok: false, error: "Use a PNG, JPEG, or WebP image." };
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return { ok: false, error: "Image is too large (max 5 MB)." };
  }

  const image: VisionImage = {
    base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
    mimeType: file.type,
  };

  try {
    const raw = await aiCompleteVision(
      userId,
      LEAD_EXTRACT_SYSTEM,
      "Extract the job lead from this screenshot.",
      image,
      1200,
    );
    return { ok: true, lead: sanitizeExtracted(raw) };
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
